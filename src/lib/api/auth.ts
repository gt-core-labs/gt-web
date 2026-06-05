/**
 * Client for the backend `/auth/*` surface.
 *
 * Since hq-web-extras.10 the auth router is annotated with utoipa, so `/auth/*`
 * is in /openapi.json and these shapes come straight from the generated schema
 * (`components['schemas']`) — no hand-maintained types. The thin fetch wrappers
 * below stay hand-written because they deal in cookies + raw `Response`, which
 * the openapi-fetch client does not surface.
 *
 * The session lives in httpOnly cookies set by Rust (gt_web_token access,
 * gt_refresh). Browser calls send them automatically; SSR must forward the
 * incoming cookie header — pass `event.fetch`.
 */
import type { components } from './schema';

type Schemas = components['schemas'];

export type Fetch = typeof globalThis.fetch;

/** Claims of the current session (GET /auth/me). */
export type SessionUser = Schemas['MeResponse'];

/** Admin user listing row (GET /auth/users). */
export type AuthUser = Schemas['UserSummary'];

/** Token payload (POST /auth/login, /auth/refresh). Cookies are set in parallel. */
export type TokenResponse = Schemas['TokenResponse'];

/** POST /auth/login body. */
export type LoginBody = Schemas['LoginRequest'];

/** POST /auth/users body. */
export type CreateUserBody = Schemas['CreateUserRequest'];

/**
 * An enabled OAuth/OIDC login provider (GET /auth/providers).
 *
 * Public, secret-free row: `kind` is the preset family (google/github/microsoft)
 * or `oidc` for a generic provider; `authorize_url` is the relative path that
 * starts the full-page OAuth redirect (e.g. `/auth/providers/{id}/authorize`).
 */
export interface Provider {
	id: string;
	kind: string;
	display_name: string;
	authorize_url: string;
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

/**
 * GET /auth/providers — PUBLIC (no auth): the enabled OAuth/OIDC providers.
 *
 * Secret-free, so it is safe to call from the unauthenticated login page (SSR
 * via `event.fetch`). Returns `[]` on any non-2xx so the page degrades to the
 * password form when no provider is configured / the backend is unreachable.
 */
export async function listProviders(fetch?: Fetch): Promise<Provider[]> {
	try {
		const res = await f(fetch)('/auth/providers', { credentials: 'same-origin' });
		if (!res.ok) return [];
		return (await res.json()) as Provider[];
	} catch {
		return [];
	}
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
