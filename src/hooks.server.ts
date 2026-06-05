import type { Handle } from '@sveltejs/kit';
import type { SessionUser } from '$lib/api/auth';
import { backendFetch } from '$lib/server/backend';
import { relaySetCookies } from '$lib/server/cookies';

async function fetchMe(cookie: string): Promise<SessionUser | null> {
	const res = await backendFetch('/auth/me', cookie);
	return res.ok ? ((await res.json()) as SessionUser) : null;
}

function cookieHeader(...pairs: Array<[string, string | undefined]>): string {
	return pairs
		.filter((p): p is [string, string] => Boolean(p[1]))
		.map(([k, v]) => `${k}=${v}`)
		.join('; ');
}

/**
 * Resolve the session on every request (SSR, against the backend directly):
 *  1. gt_web_token present → GET /auth/me.
 *  2. miss + gt_refresh present → POST /auth/refresh, relay the rotated cookies,
 *     retry /auth/me with the fresh token.
 * Populates locals.user; route guards read it from there.
 */
export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = null;

	const cookie = event.request.headers.get('cookie') ?? '';
	const access = event.cookies.get('gt_web_token');
	const refresh = event.cookies.get('gt_refresh');

	if (access) {
		event.locals.user = await fetchMe(cookie);
	}

	if (!event.locals.user && refresh) {
		const res = await backendFetch('/auth/refresh', cookie, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: '{}'
		});
		if (res.ok) {
			relaySetCookies(res.headers.getSetCookie(), event.cookies);
			// Retry /auth/me with the rotated token.
			const fresh = cookieHeader(
				['gt_web_token', event.cookies.get('gt_web_token')],
				['gt_refresh', event.cookies.get('gt_refresh')]
			);
			event.locals.user = await fetchMe(fresh);
		}
	}

	return resolve(event);
};
