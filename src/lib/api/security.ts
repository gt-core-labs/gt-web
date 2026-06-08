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
 * Human-readable labels for known scopes. The security page derives the grantable list from
 * the caller's own scopes (what the server says they hold), so this map never gates which scopes
 * appear — it only improves readability. Unknown scopes fall back to the raw scope string.
 */
const SCOPE_LABELS: Record<string, string> = {
	'tokens.read': 'Read tokens',
	'tokens.write': 'Manage tokens',
	'issues.read': 'Read issues',
	'issues.write': 'Write issues',
	'documents.read': 'Read documents',
	'documents.write': 'Write documents',
	'rig.read': 'Read rigs',
	'rig.write': 'Write rigs',
	'merge.read': 'Read merges',
	'merge.write': 'Write merges',
	'merge.submit': 'Submit merges',
	'agent.read': 'Read agents',
	'agent.write': 'Write agents',
	'quota.read': 'Read quota',
	'quota.write': 'Write quota',
	'convoy.read': 'Read convoys',
	'convoy.write': 'Write convoys',
	'meta.read': 'Read meta',
	'meta.write': 'Write meta',
	'feed.read': 'Read feed',
	'me.read': 'Read profile',
	'skills.read': 'Read skills',
	'skills.write': 'Write skills',
	'sessions.read': 'Read sessions',
	'sessions.write': 'Write sessions',
	'terminal.attach': 'Attach terminal',
	'workspace.read': 'Read workspace',
	'workspace.write': 'Write workspace',
	'worktrees.read': 'Read worktrees',
	'hooks.read': 'Read hooks',
	'hooks.write': 'Write hooks',
	'beads.read': 'Read beads',
	'beads.write': 'Write beads'
};

/** Role-label scopes that are not grantable as discrete PAT scopes. */
const NON_GRANTABLE = new Set(['*', 'workspace.admin', 'workspace.member']);

/**
 * Build the grantable scope options from the caller's own scopes. This replaces the old static
 * SCOPE_CATALOG so new backend scopes appear automatically without a frontend update.
 */
export function buildGrantable(userScopes: string[] | undefined): ScopeOption[] {
	if (!userScopes) return [];
	return userScopes
		.filter((s) => !NON_GRANTABLE.has(s))
		.map((s) => ({ scope: s, label: SCOPE_LABELS[s] ?? s }));
}

/**
 * @deprecated Use `buildGrantable(userScopes)` instead. Kept for any callers that import this
 * symbol directly; will be removed once the security page is the only consumer.
 */
export const SCOPE_CATALOG: ScopeOption[] = Object.entries(SCOPE_LABELS).map(([scope, label]) => ({
	scope,
	label
}));

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
