import { error, fail } from '@sveltejs/kit';
import { hasScope } from '$lib/api/auth';
import { TrackerError } from '$lib/api/tracker';
import type { Connection } from '$lib/api/connection';
import { serverConnection } from '$lib/server/api';
import type { Actions, PageServerLoad } from './$types';

/**
 * The GitHub add-on page: the platform GitHub App config (DB-backed) + the workspace's VCS
 * connections (the App installs that clone private repos). Registering repos as rigs lives on the
 * dedicated /rigs page. Gated on `connection.read`; writes honour `connection.write`.
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

	return { connections, connError, githubApp, canWriteConn };
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
	}
};
