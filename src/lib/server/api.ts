import type { RequestEvent } from '@sveltejs/kit';
import { tracker } from '$lib/api/tracker';
import { board } from '$lib/api/board';
import { orch } from '$lib/api/orch';
import { documents } from '$lib/api/documents';
import { admin } from '$lib/api/admin';
import { skills, feed } from '$lib/api/knowledge';
import { stats } from '$lib/api/stats';
import { meta } from '$lib/api/meta';
import { serverSystem } from '$lib/api/system';
import { connection } from '$lib/api/connection';
import { graphClient } from '$lib/api/graph';
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

/** Server-side statistics client bound to the backend + cookie. */
export function serverStats(event: RequestEvent) {
	const cookie = event.request.headers.get('cookie') ?? '';
	return stats((path, init) => backendFetch(path, cookie, init));
}

/** Server-side meta client (help catalog + report-gap) bound to the backend + cookie. */
export function serverMeta(event: RequestEvent) {
	const cookie = event.request.headers.get('cookie') ?? '';
	return meta((path, init) => backendFetch(path, cookie, init));
}

/** Server-side system config client (archive daemon config) bound to the backend + cookie. */
export function serverSystemApi(event: RequestEvent) {
	const cookie = event.request.headers.get('cookie') ?? '';
	return serverSystem((path, init) => backendFetch(path, cookie, init));
}

/** Server-side VCS-connection client (connection.* CRUD + GitHub helpers) bound to the backend + cookie. */
export function serverConnection(event: RequestEvent) {
	const cookie = event.request.headers.get('cookie') ?? '';
	return connection((path, init) => backendFetch(path, cookie, init));
}

/** Server-side knowledge-graph client (graph.list/status/refresh) bound to the backend + cookie. */
export function serverGraph(event: RequestEvent) {
	const cookie = event.request.headers.get('cookie') ?? '';
	return graphClient((path, init) => backendFetch(path, cookie, init));
}

/** Server-side board client (hq-95c2bb) bound to the backend + cookie. */
export function serverBoard(event: RequestEvent) {
	const cookie = event.request.headers.get('cookie') ?? '';
	return board((path, init) => backendFetch(path, cookie, init));
}
