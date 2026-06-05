import { fail, redirect } from '@sveltejs/kit';
import { backendFetch } from '$lib/server/backend';
import { relaySetCookies } from '$lib/server/cookies';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) throw redirect(302, '/');
	return { next: url.searchParams.get('next') ?? '/' };
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');
		const nextRaw = String(form.get('next') ?? '/');
		const next = nextRaw.startsWith('/') ? nextRaw : '/';

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
