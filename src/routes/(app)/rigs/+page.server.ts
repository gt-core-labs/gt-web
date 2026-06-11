import { error, fail } from '@sveltejs/kit';
import { hasScope } from '$lib/api/auth';
import { TrackerError } from '$lib/api/tracker';
import type { Connection } from '$lib/api/connection';
import type { GraphCustody } from '$lib/api/graph';
import { serverAdmin, serverConnection, serverGraph } from '$lib/server/api';
import { admin as adminClient, type AddRigBody } from '$lib/api/admin';
import { backendFetch } from '$lib/server/backend';
import type { WorkspaceMembership } from '$lib/api/auth';
import type { Actions, PageServerLoad } from './$types';

/**
 * Rigs (repos) for the ACTIVE workspace. Each workspace owns its own rig catalog; switch workspace
 * in the header to manage a different one. Connections (the GitHub App installs) are global and feed
 * the register picker. A per-rig "Move to…" re-homes a rig in another workspace.
 *
 * Gated on `rig.read`; writes honour `rig.write`, the graph refresh `graph.write`.
 */
export const load: PageServerLoad = async (event) => {
	if (!hasScope(event.locals.user?.scopes, 'rig.read')) {
		throw error(403, 'Requires rig.read');
	}

	let rigs: Awaited<ReturnType<ReturnType<typeof serverAdmin>['rigs']>> = [];
	let rigError: string | null = null;
	try {
		rigs = await serverAdmin(event).rigs();
	} catch (err) {
		rigError = err instanceof TrackerError ? `${err.status}: ${err.message}` : String(err);
	}

	// Connections feed the register picker (a github_app connection lists its repos). Best-effort.
	let connections: Connection[] = [];
	try {
		connections = await serverConnection(event).list();
	} catch {
		connections = [];
	}

	// Per-rig graph freshness chip (built/behind/stale), keyed by rig name. Scope-gated; degrades to —.
	const canReadGraph = hasScope(event.locals.user?.scopes, 'graph.read');
	let graphCustody: GraphCustody[] = [];
	if (canReadGraph) {
		try {
			graphCustody = await serverGraph(event).list();
		} catch {
			graphCustody = [];
		}
	}
	const canRefreshGraph = hasScope(event.locals.user?.scopes, 'graph.write');

	// Target workspaces for the per-rig "Move to…" control.
	const activeWorkspace = event.locals.user?.workspace ?? 'default';
	let workspaces: WorkspaceMembership[] = [];
	try {
		const cookie = event.request.headers.get('cookie') ?? '';
		const res = await backendFetch('/auth/workspaces', cookie);
		if (res.ok) workspaces = (await res.json()) as WorkspaceMembership[];
	} catch {
		workspaces = [];
	}

	return { rigs, rigError, connections, graphCustody, canRefreshGraph, activeWorkspace, workspaces };
};

function failFrom(err: unknown) {
	if (err instanceof TrackerError) return fail(err.status, { error: `${err.status}: ${err.message}` });
	return fail(500, { error: String(err) });
}

function str(form: FormData, key: string): string {
	return String(form.get(key) ?? '').trim();
}

function opt(form: FormData, key: string): string | undefined {
	const v = str(form, key);
	return v || undefined;
}

export const actions: Actions = {
	addRig: async (event) => {
		if (!hasScope(event.locals.user?.scopes, 'rig.write')) {
			return fail(403, { error: 'Requires rig.write' });
		}
		const form = await event.request.formData();
		const name = str(form, 'name');
		const prefix = str(form, 'prefix');
		const git_url = str(form, 'git_url');
		const default_branch = str(form, 'default_branch') || 'main';
		if (!name || !prefix || !git_url) {
			return fail(400, { error: 'Name, prefix and git URL are required.', name, prefix, git_url });
		}
		try {
			await serverAdmin(event).addRig({
				name,
				prefix,
				git_url,
				default_branch,
				push_url: opt(form, 'push_url'),
				upstream_url: opt(form, 'upstream_url'),
				git_connection_ref: opt(form, 'git_connection_ref'),
				now_secs: Math.floor(Date.now() / 1000)
			});
			return { ok: true };
		} catch (err) {
			return failFrom(err);
		}
	},

	removeRig: async (event) => {
		if (!hasScope(event.locals.user?.scopes, 'rig.write')) {
			return fail(403, { error: 'Requires rig.write' });
		}
		const name = str(await event.request.formData(), 'name');
		if (!name) return fail(400, { error: 'Missing rig name.' });
		try {
			await serverAdmin(event).removeRig(name);
			return { ok: true };
		} catch (err) {
			return failFrom(err);
		}
	},

	// Move a rig to another workspace. Rigs are strictly per-tenant with no backend "move" op, so this
	// is re-create-then-remove. The backend rejects an X-GT-Workspace that disagrees with the token
	// claim (anti-spoof), so we mint a target-scoped token via /auth/switch (validates membership),
	// use that bearer for the create — without propagating its Set-Cookie, so the session is untouched
	// — then remove from the origin (active session ws). Add-before-remove never loses the rig.
	moveRig: async (event) => {
		if (!hasScope(event.locals.user?.scopes, 'rig.write')) {
			return fail(403, { error: 'Requires rig.write' });
		}
		const form = await event.request.formData();
		const name = str(form, 'name');
		const target = str(form, 'workspace');
		const git_url = str(form, 'git_url');
		const prefix = str(form, 'prefix');
		if (!name || !target || !git_url || !prefix) {
			return fail(400, { error: 'Missing rig fields for move.' });
		}
		if (target === (event.locals.user?.workspace ?? 'default')) {
			return fail(400, { error: 'The rig is already in that workspace.' });
		}
		const body: AddRigBody = {
			name,
			prefix,
			git_url,
			default_branch: str(form, 'default_branch') || 'main',
			push_url: opt(form, 'push_url'),
			upstream_url: opt(form, 'upstream_url'),
			git_connection_ref: opt(form, 'git_connection_ref'),
			now_secs: Math.floor(Date.now() / 1000)
		};
		const cookie = event.request.headers.get('cookie') ?? '';
		const sw = await backendFetch('/auth/switch', cookie, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ workspace: target })
		});
		if (!sw.ok) {
			const msg = sw.status === 403 ? `Not a member of ${target}.` : `Switch to ${target} failed (${sw.status}).`;
			return fail(sw.status, { error: msg });
		}
		const { access_token } = (await sw.json()) as { access_token: string };
		const targetAdmin = adminClient((path, init) =>
			backendFetch(path, '', {
				...init,
				headers: { ...(init?.headers ?? {}), authorization: `Bearer ${access_token}` }
			})
		);
		try {
			await targetAdmin.addRig(body); // create in target first (token claim == target)
			await serverAdmin(event).removeRig(name); // then drop from origin (active session ws)
			return { ok: true };
		} catch (err) {
			return failFrom(err);
		}
	},

	refreshGraph: async (event) => {
		if (!hasScope(event.locals.user?.scopes, 'graph.write')) {
			return fail(403, { error: 'Requires graph.write' });
		}
		const rig = str(await event.request.formData(), 'rig');
		if (!rig) return fail(400, { error: 'Missing rig name.' });
		try {
			await serverGraph(event).refresh(rig);
			return { ok: true };
		} catch (err) {
			return failFrom(err);
		}
	}
};
