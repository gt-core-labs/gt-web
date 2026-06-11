import { error, fail } from '@sveltejs/kit';
import { hasScope } from '$lib/api/auth';
import { TrackerError } from '$lib/api/tracker';
import type { Connection } from '$lib/api/connection';
import type { GraphCustody } from '$lib/api/graph';
import type { WorkspaceMembership } from '$lib/api/auth';
import { serverAdmin, serverConnection, serverGraph } from '$lib/server/api';
import { admin as adminClient, type AddRigBody } from '$lib/api/admin';
import { backendFetch } from '$lib/server/backend';
import type { Actions, PageServerLoad } from './$types';

/**
 * The GitHub add-on page: the platform GitHub App config (DB-backed), the workspace's VCS
 * connections, and the repo register form (pick connection → repo → TARGET WORKSPACE → register).
 * A repo is registered directly into the chosen workspace (no clone-then-move). The /rigs page is
 * the read/manage view of the active workspace's rigs. Gated on `connection.read`.
 */
export const load: PageServerLoad = async (event) => {
	if (!hasScope(event.locals.user?.scopes, 'connection.read')) {
		throw error(403, 'Requires connection.read');
	}

	let connections: Connection[] = [];
	let connError: string | null = null;
	try {
		connections = await serverConnection(event).list();
	} catch (err) {
		connError = err instanceof TrackerError ? `${err.status}: ${err.message}` : String(err);
	}

	// The platform GitHub App config (hq-61ea43) — DB-backed, secret-free. `null` ⇒ not configured.
	const canWriteConn = hasScope(event.locals.user?.scopes, 'connection.write');
	let githubApp = null;
	try {
		githubApp = await serverConnection(event).githubConfig();
	} catch {
		githubApp = null;
	}

	// Target workspaces for the register form's workspace selector (where the rig is created).
	const canWriteRig = hasScope(event.locals.user?.scopes, 'rig.write');
	const activeWorkspace = event.locals.user?.workspace ?? 'default';
	let workspaces: WorkspaceMembership[] = [];
	try {
		const cookie = event.request.headers.get('cookie') ?? '';
		const res = await backendFetch('/auth/workspaces', cookie);
		if (res.ok) workspaces = (await res.json()) as WorkspaceMembership[];
	} catch {
		workspaces = [];
	}

	// The active workspace's rigs — the management table (delete / refresh) lives here (add-ons =
	// administer repos). Registering can target ANY workspace; this list is the active one.
	const canReadRigs = hasScope(event.locals.user?.scopes, 'rig.read');
	let rigs: Awaited<ReturnType<ReturnType<typeof serverAdmin>['rigs']>> = [];
	let rigError: string | null = null;
	if (canReadRigs) {
		try {
			rigs = await serverAdmin(event).rigs();
		} catch (err) {
			rigError = err instanceof TrackerError ? `${err.status}: ${err.message}` : String(err);
		}
	}
	const canReadGraph = hasScope(event.locals.user?.scopes, 'graph.read');
	let graphCustody: GraphCustody[] = [];
	if (canReadRigs && canReadGraph) {
		try {
			graphCustody = await serverGraph(event).list();
		} catch {
			graphCustody = [];
		}
	}
	const canRefreshGraph = hasScope(event.locals.user?.scopes, 'graph.write');

	return {
		connections,
		connError,
		githubApp,
		canWriteConn,
		canWriteRig,
		activeWorkspace,
		workspaces,
		rigs,
		rigError,
		graphCustody,
		canRefreshGraph
	};
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
	// A PAT fallback connection. The GitHub App install flow is NOT an action — it is a top-level
	// browser navigation / popup to GET /api/v1/connection/github/install (backend 302-redirects).
	connectPat: async (event) => {
		if (!hasScope(event.locals.user?.scopes, 'connection.write')) {
			return fail(403, { error: 'Requires connection.write' });
		}
		const form = await event.request.formData();
		const id = str(form, 'id');
		const secret = str(form, 'secret');
		const account_login = opt(form, 'account_login');
		if (!id || !secret) {
			return fail(400, { error: 'A connection id and a token are required.', formScope: 'pat' });
		}
		try {
			await serverConnection(event).create({ id, kind: 'pat', secret, account_login });
			return { ok: true };
		} catch (err) {
			return failFrom(err);
		}
	},

	// The platform GitHub App config (hq-61ea43): App ID + slug + private key (PEM) + webhook secret.
	// Secrets are write-only — a blank PEM/secret on update keeps the stored one.
	saveGithubApp: async (event) => {
		if (!hasScope(event.locals.user?.scopes, 'connection.write')) {
			return fail(403, { error: 'Requires connection.write', formScope: 'ghapp' });
		}
		const form = await event.request.formData();
		const app_id = str(form, 'app_id');
		const app_slug = str(form, 'app_slug');
		if (!app_id || !app_slug) {
			return fail(400, { error: 'App ID and slug are required.', formScope: 'ghapp' });
		}
		const body: { app_id: string; app_slug: string; private_key_pem?: string; webhook_secret?: string } = {
			app_id,
			app_slug
		};
		const pem = str(form, 'private_key_pem');
		if (pem) body.private_key_pem = pem;
		const hook = str(form, 'webhook_secret');
		if (hook) body.webhook_secret = hook;
		try {
			await serverConnection(event).setGithubConfig(body);
			return { ok: true };
		} catch (err) {
			return failFrom(err);
		}
	},

	disconnect: async (event) => {
		if (!hasScope(event.locals.user?.scopes, 'connection.write')) {
			return fail(403, { error: 'Requires connection.write' });
		}
		const id = str(await event.request.formData(), 'id');
		if (!id) return fail(400, { error: 'Missing connection id.' });
		try {
			await serverConnection(event).remove(id);
			return { ok: true };
		} catch (err) {
			return failFrom(err);
		}
	},

	// Register a repo as a rig in the CHOSEN workspace (no clone-then-move). When the target is the
	// active session ws, create directly. Otherwise mint a token scoped to the target via /auth/switch
	// (validates membership) and create with that bearer — the backend rejects a workspace header that
	// disagrees with the token claim, so a re-scoped token is the only sanctioned cross-ws path.
	addRig: async (event) => {
		if (!hasScope(event.locals.user?.scopes, 'rig.write')) {
			return fail(403, { error: 'Requires rig.write', formScope: 'rig' });
		}
		const form = await event.request.formData();
		const name = str(form, 'name');
		const prefix = str(form, 'prefix');
		const git_url = str(form, 'git_url');
		const target = str(form, 'workspace') || (event.locals.user?.workspace ?? 'default');
		if (!name || !prefix || !git_url) {
			return fail(400, { error: 'Name, prefix and git URL are required.', formScope: 'rig', name, prefix, git_url });
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
		try {
			if (target === (event.locals.user?.workspace ?? 'default')) {
				await serverAdmin(event).addRig(body);
			} else {
				const cookie = event.request.headers.get('cookie') ?? '';
				const sw = await backendFetch('/auth/switch', cookie, {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ workspace: target })
				});
				if (!sw.ok) {
					const msg = sw.status === 403 ? `Not a member of ${target}.` : `Switch to ${target} failed (${sw.status}).`;
					return fail(sw.status, { error: msg, formScope: 'rig' });
				}
				const { access_token } = (await sw.json()) as { access_token: string };
				const targetAdmin = adminClient((path, init) =>
					backendFetch(path, '', {
						...init,
						headers: { ...(init?.headers ?? {}), authorization: `Bearer ${access_token}` }
					})
				);
				await targetAdmin.addRig(body);
			}
			return { ok: true };
		} catch (err) {
			return failFrom(err);
		}
	},

	removeRig: async (event) => {
		if (!hasScope(event.locals.user?.scopes, 'rig.write')) {
			return fail(403, { error: 'Requires rig.write', formScope: 'rig' });
		}
		const name = str(await event.request.formData(), 'name');
		if (!name) return fail(400, { error: 'Missing rig name.', formScope: 'rig' });
		try {
			await serverAdmin(event).removeRig(name);
			return { ok: true };
		} catch (err) {
			return failFrom(err);
		}
	},

	refreshGraph: async (event) => {
		if (!hasScope(event.locals.user?.scopes, 'graph.write')) {
			return fail(403, { error: 'Requires graph.write', formScope: 'graph' });
		}
		const rig = str(await event.request.formData(), 'rig');
		if (!rig) return fail(400, { error: 'Missing rig name.', formScope: 'graph' });
		try {
			await serverGraph(event).refresh(rig);
			return { ok: true };
		} catch (err) {
			return failFrom(err);
		}
	}
};
