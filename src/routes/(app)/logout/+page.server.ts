import { redirect } from '@sveltejs/kit';
import { backendFetch } from '$lib/server/backend';
import { relaySetCookies } from '$lib/server/cookies';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const cookie = request.headers.get('cookie') ?? '';
		const res = await backendFetch('/auth/logout', cookie, { method: 'POST' });
		// Backend returns Max-Age=0 cookies; replay them, then hard-delete as a guard.
		relaySetCookies(res.headers.getSetCookie(), cookies);
		cookies.delete('gt_web_token', { path: '/' });
		cookies.delete('gt_refresh', { path: '/auth' });
		throw redirect(303, '/login');
	}
};
