import { error, fail } from '@sveltejs/kit';
import { hasScope } from '$lib/api/auth';
import type { PatToken } from '$lib/api/security';
import { backendFetch } from '$lib/server/backend';
import type { Actions, PageServerLoad } from './$types';

/** Parse a comma/space-separated scope field into a clean string array. */
function parseScopes(raw: string): string[] {
	return raw
		.split(/[\s,]+/)
		.map((s) => s.trim())
		.filter(Boolean);
}

export const load: PageServerLoad = async ({ locals, request }) => {
	if (!hasScope(locals.user?.scopes, 'tokens.read')) throw error(403, 'Requires tokens.read');
	const cookie = request.headers.get('cookie') ?? '';
	const res = await backendFetch('/auth/tokens', cookie);
	if (!res.ok) throw error(res.status, `Failed to list tokens (${res.status})`);
	const tokens = (await res.json()) as PatToken[];
	return { tokens };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!hasScope(locals.user?.scopes, 'tokens.write'))
			return fail(403, { error: 'Requires tokens.write' });
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const scopes = parseScopes(String(form.get('scopes') ?? ''));
		const ttlRaw = String(form.get('expires_in_days') ?? '').trim();
		if (!name) return fail(400, { error: 'A name is required.', name });

		const body: { name: string; scopes?: string[]; expires_in_secs?: number } = { name };
		if (scopes.length) body.scopes = scopes;
		if (ttlRaw) {
			const days = Number(ttlRaw);
			if (!Number.isFinite(days) || days <= 0)
				return fail(400, { error: 'Expiry (days) must be a positive number.', name });
			body.expires_in_secs = Math.round(days * 86_400);
		}

		const cookie = request.headers.get('cookie') ?? '';
		const res = await backendFetch('/auth/tokens', cookie, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (!res.ok) {
			const msg = await res.text().catch(() => '');
			return fail(res.status, { error: msg || `Create failed (${res.status})`, name });
		}
		const created = (await res.json()) as { token: string; info: PatToken };
		// Hand the plaintext back to the page ONCE — it is unrecoverable afterwards.
		return { created };
	},

	revoke: async ({ request, locals }) => {
		if (!hasScope(locals.user?.scopes, 'tokens.write'))
			return fail(403, { error: 'Requires tokens.write' });
		const form = await request.formData();
		const id = String(form.get('id') ?? '').trim();
		if (!id) return fail(400, { error: 'Missing token id.' });
		const cookie = request.headers.get('cookie') ?? '';
		const res = await backendFetch(`/auth/tokens/${encodeURIComponent(id)}`, cookie, {
			method: 'DELETE'
		});
		// 404 means it was already gone — treat as success for an idempotent revoke.
		if (!res.ok && res.status !== 404) {
			const msg = await res.text().catch(() => '');
			return fail(res.status, { error: msg || `Revoke failed (${res.status})` });
		}
		return { revoked: true };
	}
};
