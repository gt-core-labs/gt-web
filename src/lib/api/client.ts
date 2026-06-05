import createClient, { type Client } from 'openapi-fetch';
import type { paths } from './schema';

/**
 * Typed client for the backend `/api/v1/*` surface (codegen from /openapi.json).
 *
 * Same-origin: the Traefik proxy serves the FE and the API on one origin, so the
 * httpOnly session cookies (gt_web_token / gt_refresh) ride along automatically.
 *
 * SSR: pass `event.fetch` so server-side loads forward the incoming cookies.
 *   `const client = api(event.fetch);`
 * Browser: import the default `client` (uses window.fetch + credentials).
 */
export function api(fetch?: typeof globalThis.fetch): Client<paths> {
	return createClient<paths>({
		baseUrl: '/',
		credentials: 'same-origin',
		...(fetch ? { fetch } : {})
	});
}

/** Default browser-side client. In load functions prefer `api(event.fetch)`. */
export const client = api();
