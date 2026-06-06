/**
 * Client for the backend `/auth/tokens` Personal Access Token surface (hq-security-pat.2).
 *
 * Hand-typed (the same style as the cookie/raw-Response wrappers in `auth.ts`) rather than
 * generated from `/openapi.json`: these shapes are small and the page reads the plaintext token
 * exactly once, which the thin wrappers below make explicit.
 *
 * The surface is SELF-ONLY and gated by `tokens.read` / `tokens.write`: a caller manages only
 * their OWN tokens. The session rides the httpOnly `gt_web_token` cookie, sent automatically by the
 * browser; SSR forwards the incoming cookie via `$lib/server/backend`'s `backendFetch`.
 */
import type { Fetch } from './auth';

/**
 * A Personal Access Token's non-secret record (GET /auth/tokens, and the `info` of a freshly
 * minted one). The secret itself is NEVER in here — only the `id` used to revoke it.
 */
export interface PatToken {
	/** Non-secret id — the handle DELETE /auth/tokens/{id} revokes by. */
	id: string;
	/** The human label the owner gave the token. */
	name: string;
	/** The clamped scopes the token grants. */
	scopes: string[];
	/** Creation time (epoch seconds). */
	created_at: number;
	/** Expiry (epoch seconds), or `null` for a token that never expires. */
	expires_at: number | null;
	/** Last successful use (epoch seconds), or `null` if never used. */
	last_used_at: number | null;
	/** Lifecycle: `"active"` or `"revoked"`. */
	status: string;
}

/** POST /auth/tokens body. `scopes` clamps to the caller's own (omit ⇒ all they hold). */
export interface CreatePatBody {
	name: string;
	scopes?: string[];
	/** Lifetime in seconds from now; omit for a token that never expires. */
	expires_in_secs?: number;
}

/** POST /auth/tokens 201 body — the plaintext token (shown ONCE) plus its record. */
export interface CreatedPat {
	token: string;
	info: PatToken;
}

/** One selectable permission in the token-create form: a scope string + a human label. */
export interface ScopeOption {
	scope: string;
	label: string;
}

/**
 * The catalogue of scopes the create-token form offers as checkboxes. Curated to the grants a
 * user commonly hands a token (`<resource>.<verb>`); the form filters it to the ones the caller
 * actually holds (so they only see what they can grant), and the backend clamps regardless.
 *
 * The `*` "all" grant is NOT in here — the form offers it as a single "all my permissions" toggle
 * that sends an EMPTY scope set, which the backend reads as "everything the caller holds" (so it
 * yields `*` for an admin and the member's own scopes for everyone else).
 */
export const SCOPE_CATALOG: ScopeOption[] = [
	{ scope: 'tokens.read', label: 'Read tokens' },
	{ scope: 'tokens.write', label: 'Manage tokens' },
	{ scope: 'issues.read', label: 'Read issues' },
	{ scope: 'issues.write', label: 'Write issues' },
	{ scope: 'documents.read', label: 'Read documents' },
	{ scope: 'documents.write', label: 'Write documents' },
	{ scope: 'rig.read', label: 'Read rigs' },
	{ scope: 'rig.write', label: 'Write rigs' },
	{ scope: 'merge.read', label: 'Read merges' },
	{ scope: 'merge.submit', label: 'Submit merges' },
	{ scope: 'agent.read', label: 'Read agents' },
	{ scope: 'agent.write', label: 'Write agents' },
	{ scope: 'quota.read', label: 'Read quota' },
	{ scope: 'workspace.read', label: 'Read workspace' }
];

function f(fetch?: Fetch): Fetch {
	return fetch ?? globalThis.fetch;
}

const JSON_HEADERS = { 'content-type': 'application/json' };

/** GET /auth/tokens — the caller's own tokens. Requires scope `tokens.read`. */
export async function listTokens(fetch?: Fetch): Promise<PatToken[]> {
	const res = await f(fetch)('/auth/tokens', { credentials: 'same-origin' });
	if (!res.ok) throw new Error(`listTokens: ${res.status}`);
	return (await res.json()) as PatToken[];
}

/**
 * POST /auth/tokens — mint a token. Requires scope `tokens.write`. The returned `token` plaintext
 * is recoverable ONLY here (the backend keeps just its hash), so the caller must surface it once.
 */
export async function createToken(body: CreatePatBody, fetch?: Fetch): Promise<CreatedPat> {
	const res = await f(fetch)('/auth/tokens', {
		method: 'POST',
		headers: JSON_HEADERS,
		credentials: 'same-origin',
		body: JSON.stringify(body)
	});
	if (!res.ok) throw new Error(`createToken: ${res.status}`);
	return (await res.json()) as CreatedPat;
}

/** DELETE /auth/tokens/{id} — revoke one of the caller's own tokens. Requires scope `tokens.write`. */
export async function revokeToken(id: string, fetch?: Fetch): Promise<Response> {
	return f(fetch)(`/auth/tokens/${encodeURIComponent(id)}`, {
		method: 'DELETE',
		credentials: 'same-origin'
	});
}
