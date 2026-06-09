import { error, fail } from '@sveltejs/kit';
import {
	hasScope,
	PRESET_KINDS,
	type CreateProviderBody,
	type ProviderAdmin,
	type ProviderKind,
	type UpdateProviderBody
} from '$lib/api/auth';
import { backendFetch } from '$lib/server/backend';
import type { Actions, PageServerLoad } from './$types';

/** System admin = superuser scope `*`; the provider store is global deploy infra. */
function isAdmin(scopes: string[] | undefined): boolean {
	return hasScope(scopes, '*');
}

const VALID_KINDS: ProviderKind[] = ['google', 'github', 'microsoft', 'generic'];

function parseKind(raw: string): ProviderKind | null {
	return (VALID_KINDS as string[]).includes(raw) ? (raw as ProviderKind) : null;
}

export const load: PageServerLoad = async ({ locals, request, url }) => {
	if (!isAdmin(locals.user?.scopes)) throw error(403, 'Requires system admin (scope *)');
	const cookie = request.headers.get('cookie') ?? '';

	// Degrade gracefully instead of throwing: a backend that lacks the provider
	// endpoints (404) or hits a schema mismatch (500) would otherwise render a hard
	// error page. Surface an empty list + a banner so the admin still sees the page.
	let providers: ProviderAdmin[] = [];
	let loadError: string | null = null;
	try {
		const res = await backendFetch('/auth/providers/all', cookie);
		if (res.ok) {
			providers = (await res.json()) as ProviderAdmin[];
		} else {
			const detail = await res.text().catch(() => '');
			loadError = `No se pudieron listar los providers (${res.status}). ${detail}`.trim();
		}
	} catch (e) {
		loadError = `No se pudo contactar el backend de providers: ${e instanceof Error ? e.message : String(e)}`;
	}

	// `?edit=<id>` pre-fills the edit form by fetching the single (secret-free) view.
	let editing: ProviderAdmin | null = null;
	const editId = url.searchParams.get('edit');
	if (editId && !loadError) {
		const one = await backendFetch(`/auth/providers/${encodeURIComponent(editId)}`, cookie);
		if (one.ok) editing = (await one.json()) as ProviderAdmin;
	}

	return { providers, editing, loadError };
};

/** Trim a form value to string; empty string when absent. */
function str(form: FormData, key: string): string {
	return String(form.get(key) ?? '').trim();
}

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!isAdmin(locals.user?.scopes)) return fail(403, { error: 'Requires system admin (scope *)' });
		const form = await request.formData();
		const id = str(form, 'id');
		const kind = parseKind(str(form, 'kind'));
		const display_name = str(form, 'display_name');
		const client_id = str(form, 'client_id');
		const client_secret = str(form, 'client_secret');

		if (!id || !kind || !display_name || !client_id || !client_secret) {
			return fail(400, { error: 'id, kind, display name, client id and client secret are required.' });
		}

		const body: CreateProviderBody = { id, kind, display_name, client_id, client_secret };
		// Generic providers carry no baked endpoints — the admin supplies them all.
		if (!PRESET_KINDS.includes(kind)) {
			const issuer = str(form, 'issuer');
			const authorize_endpoint = str(form, 'authorize_endpoint');
			const token_endpoint = str(form, 'token_endpoint');
			const userinfo_endpoint = str(form, 'userinfo_endpoint');
			const scopes = str(form, 'scopes');
			if (!issuer || !authorize_endpoint || !token_endpoint || !userinfo_endpoint || !scopes) {
				return fail(400, { error: 'A generic provider needs issuer, all endpoints and scopes.' });
			}
			Object.assign(body, { issuer, authorize_endpoint, token_endpoint, userinfo_endpoint, scopes });
		}

		const cookie = request.headers.get('cookie') ?? '';
		const res = await backendFetch('/auth/providers', cookie, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (!res.ok) {
			const msg = await res.text().catch(() => '');
			return fail(res.status, { error: msg || `Create failed (${res.status})` });
		}
		return { ok: true };
	},

	update: async ({ request, locals }) => {
		if (!isAdmin(locals.user?.scopes)) return fail(403, { error: 'Requires system admin (scope *)' });
		const form = await request.formData();
		const id = str(form, 'id');
		if (!id) return fail(400, { error: 'Missing provider id.' });

		// Only non-empty fields are sent; `client_secret` left blank is OMITTED so the
		// stored secret is kept (write-only rotate).
		const body: UpdateProviderBody = {
			display_name: str(form, 'display_name'),
			client_id: str(form, 'client_id'),
			enabled: form.get('enabled') === 'on'
		};
		const secret = str(form, 'client_secret');
		if (secret) body.client_secret = secret;

		// Generic providers may also edit their endpoints/scopes.
		for (const key of ['issuer', 'authorize_endpoint', 'token_endpoint', 'userinfo_endpoint', 'scopes'] as const) {
			const v = str(form, key);
			if (v) body[key] = v;
		}

		const cookie = request.headers.get('cookie') ?? '';
		const res = await backendFetch(`/auth/providers/${encodeURIComponent(id)}`, cookie, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (!res.ok) {
			const msg = await res.text().catch(() => '');
			return fail(res.status, { error: msg || `Update failed (${res.status})` });
		}
		return { ok: true };
	},

	toggle: async ({ request, locals }) => {
		if (!isAdmin(locals.user?.scopes)) return fail(403, { error: 'Requires system admin (scope *)' });
		const form = await request.formData();
		const id = str(form, 'id');
		const enabled = form.get('enabled') === 'true';
		if (!id) return fail(400, { error: 'Missing provider id.' });

		const cookie = request.headers.get('cookie') ?? '';
		const res = await backendFetch(`/auth/providers/${encodeURIComponent(id)}`, cookie, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ enabled })
		});
		if (!res.ok) {
			const msg = await res.text().catch(() => '');
			return fail(res.status, { error: msg || `Toggle failed (${res.status})` });
		}
		return { ok: true };
	},

	delete: async ({ request, locals }) => {
		if (!isAdmin(locals.user?.scopes)) return fail(403, { error: 'Requires system admin (scope *)' });
		const id = str(await request.formData(), 'id');
		if (!id) return fail(400, { error: 'Missing provider id.' });

		const cookie = request.headers.get('cookie') ?? '';
		const res = await backendFetch(`/auth/providers/${encodeURIComponent(id)}`, cookie, { method: 'DELETE' });
		if (!res.ok) {
			const msg = await res.text().catch(() => '');
			return fail(res.status, { error: msg || `Delete failed (${res.status})` });
		}
		return { ok: true };
	}
};
