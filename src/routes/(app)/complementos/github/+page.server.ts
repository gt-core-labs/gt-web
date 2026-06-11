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
 * The GitHub complemento detail page (epic hq-vcs-connections.6). Two zones:
 *   1. CONEXIONES — list the workspace's VCS connections (GET /api/v1/connection),
 *      Connect-GitHub (the App install flow, a browser navigation), and a PAT fallback.
 *   2. REPOS — the rig CRUD moved here from /admin/rigs, with a connection-aware
 *      register form (connection picker → repo dropdown → fills git_url +
 *      git_connection_ref; free-text git_url kept as the fallback).
 *
 * Gated on `connection.read` for the page; the repo zone additionally honours
 * `rig.read` / `rig.write`, and the connection writes honour `connection.write`.
 * Both backend surfaces degrade instead of white-screening: a freshly switched-into
 * tenant whose schema is not yet provisioned, or a backend that predates the
 * connection bead, surfaces an empty list + a banner rather than a hard error.
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

	// The platform GitHub App config (hq-61ea43) — DB-backed, secret-free. `null` ⇒ not configured
	// yet (the form prompts to set it). Best-effort: a backend that predates it degrades to null.
	const canWriteConn = hasScope(event.locals.user?.scopes, 'connection.write');
	let githubApp = null;
	try {
		githubApp = await serverConnection(event).githubConfig();
	} catch {
		githubApp = null;
	}

	// The repo zone is only shown when the caller can read rigs; load them best-effort.
	let rigs: Awaited<ReturnType<ReturnType<typeof serverAdmin>['rigs']>> = [];
	let rigError: string | null = null;
	const canReadRigs = hasScope(event.locals.user?.scopes, 'rig.read');
	if (canReadRigs) {
		try {
			rigs = await serverAdmin(event).rigs();
		} catch (err) {
			rigError = err instanceof TrackerError ? `${err.status}: ${err.message}` : String(err);
		}
	}

	// Per-repo graph freshness (hq-vcs-connections.9): one `GET /api/v1/graph` lists every rig under
	// warden custody with its freshness, keyed by rig name. The page maps it onto each repo row's
	// chip (built/stale/behind, or `—` when the rig has no custody / the backend predates the
	// surface). Best-effort + scope-gated on `graph.read`; a 404 (older backend) degrades to `—`.
	const canReadGraph = hasScope(event.locals.user?.scopes, 'graph.read');
	let graphCustody: GraphCustody[] = [];
	if (canReadRigs && canReadGraph) {
		try {
			graphCustody = await serverGraph(event).list();
		} catch {
			// Silent degrade: the chip falls back to `—`. No banner — the graph surface is optional.
			graphCustody = [];
		}
	}
	const canRefreshGraph = hasScope(event.locals.user?.scopes, 'graph.write');

	// The workspaces the caller can switch into — the target list for the per-rig "Mover a workspace"
	// action. Best-effort: a single-tenant deploy / older backend degrades to just the active one.
	const activeWorkspace = event.locals.user?.workspace ?? 'default';
	let workspaces: WorkspaceMembership[] = [];
	try {
		const cookie = event.request.headers.get('cookie') ?? '';
		const res = await backendFetch('/auth/workspaces', cookie);
		if (res.ok) workspaces = (await res.json()) as WorkspaceMembership[];
	} catch {
		workspaces = [];
	}

	return {
		connections,
		connError,
		githubApp,
		canWriteConn,
		rigs,
		rigError,
		canReadRigs,
		graphCustody,
		canRefreshGraph,
		activeWorkspace,
		workspaces
	};
};

function failFrom(err: unknown) {
	if (err instanceof TrackerError) return fail(err.status, { error: `${err.status}: ${err.message}` });
	return fail(500, { error: String(err) });
}

/** Trimmed form value; empty string when absent. */
function str(form: FormData, key: string): string {
	return String(form.get(key) ?? '').trim();
}

/** Optional text field → undefined when blank (so it is omitted from the body). */
function opt(form: FormData, key: string): string | undefined {
	const v = str(form, key);
	return v || undefined;
}

export const actions: Actions = {
	// ── Connections ──────────────────────────────────────────────────────────
	// A PAT fallback connection. The GitHub App install flow is NOT an action —
	// it is a top-level browser navigation to GET /api/v1/connection/github/install
	// (the backend 302-redirects to the App install page), handled client-side.
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
	// Secrets are write-only — a blank PEM/secret on update keeps the stored one. DB-backed, so this
	// configures the App with no redeploy and lights up the install flow + webhook.
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

	// ── Repos (moved from /admin/rigs) ───────────────────────────────────────
	addRig: async (event) => {
		if (!hasScope(event.locals.user?.scopes, 'rig.write')) {
			return fail(403, { error: 'Requires rig.write', formScope: 'rig' });
		}
		const form = await event.request.formData();
		const name = str(form, 'name');
		const prefix = str(form, 'prefix');
		const git_url = str(form, 'git_url');
		const default_branch = str(form, 'default_branch') || 'main';
		if (!name || !prefix || !git_url) {
			return fail(400, {
				error: 'Name, prefix and git URL are required.',
				formScope: 'rig',
				name,
				prefix,
				git_url
			});
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

	// Move a rig to another workspace. Rigs are strictly per-tenant with no backend "move" op, so
	// this is re-create-then-remove: ADD in the target workspace (via the sanctioned X-GT-Workspace
	// header) carrying the rig's git config, then REMOVE from the origin (the active session ws). Add
	// goes first so a failure never loses the rig. The graph custody does not travel — re-index after.
	moveRig: async (event) => {
		if (!hasScope(event.locals.user?.scopes, 'rig.write')) {
			return fail(403, { error: 'Requires rig.write', formScope: 'rig' });
		}
		const form = await event.request.formData();
		const name = str(form, 'name');
		const target = str(form, 'workspace');
		const git_url = str(form, 'git_url');
		const prefix = str(form, 'prefix');
		if (!name || !target || !git_url || !prefix) {
			return fail(400, { error: 'Missing rig fields for move.', formScope: 'rig' });
		}
		if (target === (event.locals.user?.workspace ?? 'default')) {
			return fail(400, { error: 'The rig is already in that workspace.', formScope: 'rig' });
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
		// A one-off admin client targeting `target` via the sanctioned workspace header. Works for a
		// caller with rig.write in the target (system admin `*` spans every workspace).
		const targetAdmin = adminClient((path, init) =>
			backendFetch(path, cookie, {
				...init,
				headers: { ...(init?.headers ?? {}), 'X-GT-Workspace': target }
			})
		);
		try {
			await targetAdmin.addRig(body); // create in target FIRST
			await serverAdmin(event).removeRig(name); // then drop from origin (active ws)
			return { ok: true };
		} catch (err) {
			return failFrom(err);
		}
	},

	// ── Graph (hq-vcs-connections.9) ─────────────────────────────────────────
	// The per-repo "Refresh" button: trigger a `graph.refresh` for one rig (clone/fetch the default
	// branch at the server-derived path + re-index). Default-branch-only — no branch selector. Needs
	// `graph.write`; on success the page reloads and the chip reflects the new freshness.
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
