import { fail, redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import { backendFetch } from '$lib/server/backend';
import { relaySetCookies } from '$lib/server/cookies';
import type { Provider } from '$lib/api/auth';
import type { Actions, PageServerLoad } from './$types';

/** Fetch the enabled OAuth/OIDC providers; `[]` on any error (degrade to password). */
async function loadProviders(): Promise<Provider[]> {
	try {
		const res = await backendFetch('/auth/providers', '');
		if (!res.ok) return [];
		return (await res.json()) as Provider[];
	} catch {
		return [];
	}
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) throw redirect(302, `${base}/`);
	return {
		next: url.searchParams.get('next') ?? `${base}/`,
		providers: await loadProviders()
	};
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');
		const nextRaw = String(form.get('next') ?? `${base}/`);
		const next = nextRaw.startsWith('/') ? nextRaw : `${base}/`;

		if (!email || !password) {
			return fail(400, { error: 'Email and password are required.', email });
		}

		const res = await backendFetch('/auth/login', '', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email, password })
		});
		if (!res.ok) {
			return fail(res.status === 401 ? 401 : 502, {
				error: res.status === 401 ? 'Invalid credentials.' : 'Login failed, try again.',
				email
			});
		}

		// Replay the backend session cookies onto the browser, then land in-app.
		relaySetCookies(res.headers.getSetCookie(), cookies);
		throw redirect(303, next);
	}
};
