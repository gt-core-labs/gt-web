import { error, fail } from '@sveltejs/kit';
import { hasScope, type AuthUser } from '$lib/api/auth';
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
	if (!hasScope(locals.user?.scopes, 'users.read')) throw error(403, 'Requires users.read');
	const cookie = request.headers.get('cookie') ?? '';
	const res = await backendFetch('/auth/users', cookie);
	if (!res.ok) throw error(res.status, `Failed to list users (${res.status})`);
	const users = (await res.json()) as AuthUser[];
	return { users };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!hasScope(locals.user?.scopes, 'users.write')) return fail(403, { error: 'Requires users.write' });
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');
		const scopes = parseScopes(String(form.get('scopes') ?? ''));
		if (!email || !password) return fail(400, { error: 'Email and password are required.', email });

		const cookie = request.headers.get('cookie') ?? '';
		const res = await backendFetch('/auth/users', cookie, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email, password, scopes })
		});
		if (!res.ok) {
			const msg = await res.text().catch(() => '');
			return fail(res.status, { error: msg || `Create failed (${res.status})`, email });
		}
		return { ok: true };
	}
};
