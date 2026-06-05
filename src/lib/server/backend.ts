import { env } from '$env/dynamic/private';

/**
 * Absolute base URL of the Rust backend, for SSR-side calls only.
 *
 * Server-side we MUST NOT use relative `/auth` `/api` URLs: SvelteKit's
 * `event.fetch` resolves same-origin paths in-process (re-entering hooks →
 * infinite recursion on /auth/me), and in prod the node server sits behind
 * Traefik — a relative fetch would hit the FE router, never the backend.
 * So SSR talks to the backend directly via this URL with the global `fetch`.
 *
 * The browser keeps using relative paths (Traefik / vite proxy routes them).
 */
export const BACKEND_URL = (env.GT_BACKEND_URL ?? 'http://127.0.0.1:8765').replace(/\/$/, '');

/** SSR fetch against the backend, forwarding the request's cookies verbatim. */
export function backendFetch(path: string, cookie: string, init: RequestInit = {}): Promise<Response> {
	const headers = new Headers(init.headers);
	if (cookie) headers.set('cookie', cookie);
	return fetch(`${BACKEND_URL}${path}`, { ...init, headers });
}
