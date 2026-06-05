import type { RequestEvent } from '@sveltejs/kit';
import { tracker } from '$lib/api/tracker';
import { backendFetch } from './backend';

/**
 * Server-side tracker bound to the backend (absolute URL) with the request's
 * cookies forwarded — for use in SSR load functions / actions.
 */
export function serverTracker(event: RequestEvent) {
	const cookie = event.request.headers.get('cookie') ?? '';
	return tracker((path, init) => backendFetch(path, cookie, init));
}
