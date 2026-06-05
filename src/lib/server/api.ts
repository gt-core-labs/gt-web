import type { RequestEvent } from '@sveltejs/kit';
import { tracker } from '$lib/api/tracker';
import { orch } from '$lib/api/orch';
import { documents } from '$lib/api/documents';
import { admin } from '$lib/api/admin';
import { skills, feed } from '$lib/api/knowledge';
import { backendFetch } from './backend';

/**
 * Server-side tracker bound to the backend (absolute URL) with the request's
 * cookies forwarded — for use in SSR load functions / actions.
 */
export function serverTracker(event: RequestEvent) {
	const cookie = event.request.headers.get('cookie') ?? '';
	return tracker((path, init) => backendFetch(path, cookie, init));
}

/** Server-side orchestration client (agent/merge/quota) bound to the backend + cookie. */
export function serverOrch(event: RequestEvent) {
	const cookie = event.request.headers.get('cookie') ?? '';
	return orch((path, init) => backendFetch(path, cookie, init));
}

/** Server-side documents client bound to the backend + cookie. */
export function serverDocs(event: RequestEvent) {
	const cookie = event.request.headers.get('cookie') ?? '';
	return documents((path, init) => backendFetch(path, cookie, init));
}

/** Server-side admin client (workspace/rig/quota) bound to the backend + cookie. */
export function serverAdmin(event: RequestEvent) {
	const cookie = event.request.headers.get('cookie') ?? '';
	return admin((path, init) => backendFetch(path, cookie, init));
}

/** Server-side skills catalog client bound to the backend + cookie. */
export function serverSkills(event: RequestEvent) {
	const cookie = event.request.headers.get('cookie') ?? '';
	return skills((path, init) => backendFetch(path, cookie, init));
}

/** Server-side activity feed client bound to the backend + cookie. */
export function serverFeed(event: RequestEvent) {
	const cookie = event.request.headers.get('cookie') ?? '';
	return feed((path, init) => backendFetch(path, cookie, init));
}
