/**
 * Hand-written client for the backend `/auth/*` surface.
 *
 * `/auth/*` is NOT in /openapi.json (the router carries no utoipa annotations),
 * so codegen does not cover it — these shapes are maintained by hand until
 * hq-web-extras.10 annotates auth. Verified against the live backend.
 *
 * The session lives in httpOnly cookies set by Rust (gt_web_token access,
 * gt_refresh). Browser calls send them automatically; SSR must forward the
 * incoming cookie header — pass `event.fetch`.
 */

export type Fetch = typeof globalThis.fetch;

/** Claims of the current session (GET /auth/me). */
export interface SessionUser {
	sub: string;
	workspace: string;
	scopes: string[];
}

/** Admin user listing row (GET /auth/users). */
export interface AuthUser {
	sub: string;
	email: string;
	scopes: string[];
	created_at: number;
}

/** Token payload (POST /auth/login, /auth/refresh). Cookies are set in parallel. */
export interface TokenResponse {
	access_token: string;
	refresh_token: string;
	token_type: string;
	expires_in: number;
}

export interface LoginBody {
	email: string;
	password: string;
}

export interface CreateUserBody {
	email: string;
	password: string;
	scopes?: string[];
}

function f(fetch?: Fetch): Fetch {
	return fetch ?? globalThis.fetch;
}

const JSON_HEADERS = { 'content-type': 'application/json' };

/** POST /auth/login — on success the response carries Set-Cookie for both tokens. */
export async function login(body: LoginBody, fetch?: Fetch): Promise<Response> {
	return f(fetch)('/auth/login', {
		method: 'POST',
		headers: JSON_HEADERS,
		credentials: 'same-origin',
		body: JSON.stringify(body)
	});
}

/** POST /auth/refresh — reads gt_refresh cookie (body fallback). Rotates cookies. */
export async function refresh(fetch?: Fetch): Promise<Response> {
	return f(fetch)('/auth/refresh', {
		method: 'POST',
		headers: JSON_HEADERS,
		credentials: 'same-origin',
		body: '{}'
	});
}

/** POST /auth/logout — clears both cookies (Max-Age=0). */
export async function logout(fetch?: Fetch): Promise<Response> {
	return f(fetch)('/auth/logout', { method: 'POST', credentials: 'same-origin' });
}

/** GET /auth/me — returns the session claims, or null when unauthenticated (401). */
export async function me(fetch?: Fetch): Promise<SessionUser | null> {
	const res = await f(fetch)('/auth/me', { credentials: 'same-origin' });
	if (!res.ok) return null;
	return (await res.json()) as SessionUser;
}

/** GET /auth/users — requires scope users.read (or *). */
export async function listUsers(fetch?: Fetch): Promise<AuthUser[]> {
	const res = await f(fetch)('/auth/users', { credentials: 'same-origin' });
	if (!res.ok) throw new Error(`listUsers: ${res.status}`);
	return (await res.json()) as AuthUser[];
}

/** POST /auth/users — requires scope users.write (or *). */
export async function createUser(body: CreateUserBody, fetch?: Fetch): Promise<Response> {
	return f(fetch)('/auth/users', {
		method: 'POST',
		headers: JSON_HEADERS,
		credentials: 'same-origin',
		body: JSON.stringify(body)
	});
}

/**
 * Scope check mirroring the backend grammar: `*` is superuser, `mod.*` matches
 * any action under a module, otherwise an exact match is required.
 */
export function hasScope(scopes: string[] | undefined, needed: string): boolean {
	if (!scopes) return false;
	for (const s of scopes) {
		if (s === '*' || s === needed) return true;
		if (s.endsWith('.*') && needed.startsWith(s.slice(0, -1))) return true;
	}
	return false;
}
