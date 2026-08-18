import { error, fail } from '@sveltejs/kit';
import { hasScope } from '$lib/api/auth';
import { backendFetch } from '$lib/server/backend';
import type { Actions, PageServerLoad } from './$types';

/** System admin = superuser scope `*`; the client store is global deploy infra. */
function isAdmin(scopes: string[] | undefined): boolean {
	return hasScope(scopes, '*');
}

export interface OAuthClientView {
	client_id: string;
	display_name: string;
	redirect_uris: string[];
	allowed_scopes: string;
	enabled: boolean;
}

export const load: PageServerLoad = async ({ locals, request, url }) => {
	if (!isAdmin(locals.user?.scopes)) throw error(403, 'Requires system admin (scope *)');
	const cookie = request.headers.get('cookie') ?? '';

	let clients: OAuthClientView[] = [];
	let loadError: string | null = null;
	try {
		const res = await backendFetch('/auth/clients', cookie);
		if (res.ok) {
			clients = (await res.json()) as OAuthClientView[];
		} else {
			const detail = await res.text().catch(() => '');
			loadError = `No se pudieron listar los OAuth clients (${res.status}). ${detail}`.trim();
		}
	} catch (e) {
		loadError = `No se pudo contactar el backend: ${e instanceof Error ? e.message : String(e)}`;
	}

	let editing: OAuthClientView | null = null;
	const editId = url.searchParams.get('edit');
	if (editId && !loadError) {
		const one = await backendFetch(`/auth/clients/${encodeURIComponent(editId)}`, cookie);
		if (one.ok) editing = (await one.json()) as OAuthClientView;
	}

	return { clients, editing, loadError };
};

function str(form: FormData, key: string): string {
	return String(form.get(key) ?? '').trim();
}

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!isAdmin(locals.user?.scopes)) return fail(403, { error: 'Requires system admin (scope *)' });
		const form = await request.formData();
		const client_id = str(form, 'client_id');
		const client_secret = str(form, 'client_secret');
		const display_name = str(form, 'display_name');
		const redirect_uris_raw = str(form, 'redirect_uris');
		const allowed_scopes = str(form, 'allowed_scopes');

		if (!client_id || !client_secret || !display_name) {
			return fail(400, { error: 'client_id, client_secret and display_name are required.' });
		}

		const redirect_uris = redirect_uris_raw
			.split(/[\n,]/)
			.map((u) => u.trim())
			.filter(Boolean);

		const cookie = request.headers.get('cookie') ?? '';
		const res = await backendFetch('/auth/clients', cookie, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ client_id, client_secret, display_name, redirect_uris, allowed_scopes, enabled: true })
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
		const id = str(form, 'client_id');
		if (!id) return fail(400, { error: 'Missing client_id.' });

		const body: Record<string, unknown> = {
			display_name: str(form, 'display_name') || undefined,
			allowed_scopes: str(form, 'allowed_scopes'),
			enabled: form.get('enabled') === 'on'
		};
		const secret = str(form, 'client_secret');
		if (secret) body.client_secret = secret;

		const redirect_uris_raw = str(form, 'redirect_uris');
		body.redirect_uris = redirect_uris_raw
			.split(/[\n,]/)
			.map((u) => u.trim())
			.filter(Boolean);

		const cookie = request.headers.get('cookie') ?? '';
		const res = await backendFetch(`/auth/clients/${encodeURIComponent(id)}`, cookie, {
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
		const id = str(form, 'client_id');
		const enabled = form.get('enabled') === 'true';
		if (!id) return fail(400, { error: 'Missing client_id.' });

		const cookie = request.headers.get('cookie') ?? '';
		const res = await backendFetch(`/auth/clients/${encodeURIComponent(id)}`, cookie, {
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
		const id = str(await request.formData(), 'client_id');
		if (!id) return fail(400, { error: 'Missing client_id.' });

		const cookie = request.headers.get('cookie') ?? '';
		const res = await backendFetch(`/auth/clients/${encodeURIComponent(id)}`, cookie, { method: 'DELETE' });
		if (!res.ok) {
			const msg = await res.text().catch(() => '');
			return fail(res.status, { error: msg || `Delete failed (${res.status})` });
		}
		return { ok: true };
	}
};
