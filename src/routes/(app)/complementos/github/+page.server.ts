import { error, fail } from '@sveltejs/kit';
import { hasScope } from '$lib/api/auth';
import { TrackerError } from '$lib/api/tracker';
import type { Connection } from '$lib/api/connection';
import { serverAdmin, serverConnection } from '$lib/server/api';
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

	return { connections, connError, rigs, rigError, canReadRigs };
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
	}
};
