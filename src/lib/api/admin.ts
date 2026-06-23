/**
 * Admin client for the workspace / rig / quota REST surfaces (`hq-gtweb.6`).
 *
 * Like the tracker + orch clients, the OpenAPI spec carries no request/response
 * *bodies* for these routes (thin utoipa annotations), so the shapes below are
 * hand-typed against the live backend (gt-workspace / gt-rig / gt-quota). The
 * list/create routes are the bare module prefix with NO trailing slash
 * (`/api/v1/workspace`, not `/api/v1/workspace/` — the latter 404s, exactly like
 * the tracker `/api/v1/issues` surface; a 404 here surfaces as an SSR 500).
 *
 * `admin(fetcher)` is transport-agnostic: pass a browser fetcher (relative,
 * same-origin cookies) or a server one (absolute backend + forwarded cookie).
 *
 * The users surface lives under `/auth/*` and is already covered by
 * `$lib/api/auth` (listUsers / createUser); it is intentionally not duplicated
 * here.
 */
import { TrackerError, type Fetcher } from './tracker';
import type { QuotaAccount } from './orch';

export type { QuotaAccount, QuotaWindow } from './orch';

/** One `quota.window_reset.v1` payload — consumed tokens captured just before a window rolled over. */
export interface WindowReset {
	account: string;
	kind: string;
	consumed: number;
	started_at_secs: number;
	resets_at_secs: number;
}

/** One `quota.tokens_sampled.v1` payload — per-call token usage attributed to a session + model. */
export interface TokenSample {
	account: string;
	session: string;
	model: string;
	input: number;
	output: number;
	cache_read: number;
	cache_creation: number;
	now_secs: number;
}

export type WorkspaceStatus = 'active' | 'suspended' | 'archived';

/** A workspace catalog entry — `{ id, name, status }` across MCP + REST. */
export interface Workspace {
	id: string;
	name: string;
	status: WorkspaceStatus;
}

/** A rig catalog entry, as returned by `GET /api/v1/rig/`. */
export interface Rig {
	name: string;
	prefix: string;
	git_url: string;
	push_url: string | null;
	upstream_url: string | null;
	default_branch: string;
	/** UTC epoch seconds the rig was first registered. */
	registered_at_secs: number;
	/** Absolute worktree-root override; absent ⇒ the convention default. */
	worktree_root?: string | null;
	/**
	 * Soft reference to the `vcs_connections.id` this rig clones with
	 * (hq-vcs-connections.3). Absent ⇒ the rig is cloned with no connection (a public
	 * repo, or the legacy free-text URL).
	 */
	git_connection_ref?: string | null;
}

/** `POST /api/v1/workspace/` body. */
export interface CreateWorkspaceBody {
	id: string;
	name: string;
}

/** `POST /api/v1/rig/` body. `now_secs` is stamped at the edge (client clock). */
export interface AddRigBody {
	name: string;
	prefix: string;
	git_url: string;
	default_branch: string;
	push_url?: string;
	upstream_url?: string;
	/** Soft reference to the `vcs_connections.id` to clone with (hq-vcs-connections.3). */
	git_connection_ref?: string;
	now_secs: number;
}

/** `POST /api/v1/quota/onboard/start` response — the login URL + the session to resume. */
export interface OnboardStart {
	session_id: string;
	url: string;
}

/** `POST /api/v1/quota/onboard/complete` response — the captured account + its credentials dir. */
export interface OnboardComplete {
	account: string;
	config_dir: string;
}

/**
 * Per-account credential health (gtcore-3cab31 / gtcore-1fe9b4). Distinct from quota *usage*:
 * an account can be quota-`Healthy` while its keychain credential is dead (no refresh token, or
 * the config dir never completed onboarding), which is the silent-401 hole this surfaces.
 * `id` is the account email, matching {@link QuotaAccount.id}.
 */
export interface CredHealth {
	id: string;
	/** A refresh token is stored in the dir's `.credentials.json`. */
	refresh_present: boolean;
	/** Unix epoch the stored credential expires; null = unknown. */
	expires_at_secs: number | null;
	/** The dir carries `oauthAccount` + `hasCompletedOnboarding` (consumable by the sling pre-authed). */
	onboarding_complete: boolean;
	/** Backend-computed flag: the account needs an operator relogin to become usable. */
	needs_relogin: boolean;
}

/** `POST /api/v1/quota/relogin/start` response — the OAuth URL to visit + the session to resume. */
export interface ReloginStart {
	session_id: string;
	url: string;
}

/** `POST /api/v1/quota/relogin/complete` response — the refreshed account + its new expiry. */
export interface ReloginComplete {
	account: string;
	expires_at_secs?: number | null;
}

const JSON_POST = { method: 'POST', headers: { 'content-type': 'application/json' } } as const;

async function unwrap<T>(res: Response): Promise<T> {
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new TrackerError(res.status, text || res.statusText);
	}
	return (await res.json()) as T;
}

export function admin(doFetch: Fetcher) {
	const wsPath = (id: string) => `/api/v1/workspace/${encodeURIComponent(id)}`;
	const rigPath = (name: string) => `/api/v1/rig/${encodeURIComponent(name)}`;
	const quotaPath = (account: string) => `/api/v1/quota/${encodeURIComponent(account)}`;
	return {
		// --- workspaces -----------------------------------------------------------
		async workspaces(): Promise<Workspace[]> {
			const j = await unwrap<{ workspaces: Workspace[] }>(await doFetch('/api/v1/workspace'));
			return j.workspaces ?? [];
		},
		async createWorkspace(body: CreateWorkspaceBody): Promise<void> {
			await unwrap(await doFetch('/api/v1/workspace', { ...JSON_POST, body: JSON.stringify(body) }));
		},
		async suspendWorkspace(id: string): Promise<void> {
			await unwrap(await doFetch(`${wsPath(id)}/suspend`, { ...JSON_POST, body: '{}' }));
		},
		async resumeWorkspace(id: string): Promise<void> {
			await unwrap(await doFetch(`${wsPath(id)}/resume`, { ...JSON_POST, body: '{}' }));
		},
		async archiveWorkspace(id: string): Promise<void> {
			await unwrap(await doFetch(`${wsPath(id)}/archive`, { ...JSON_POST, body: '{}' }));
		},

		// --- rigs -----------------------------------------------------------------
		async rigs(): Promise<Rig[]> {
			const j = await unwrap<{ rigs: Rig[] }>(await doFetch('/api/v1/rig'));
			return j.rigs ?? [];
		},
		async addRig(body: AddRigBody): Promise<void> {
			await unwrap(await doFetch('/api/v1/rig', { ...JSON_POST, body: JSON.stringify(body) }));
		},
		async removeRig(name: string): Promise<void> {
			await unwrap(await doFetch(rigPath(name), { method: 'DELETE' }));
		},

		// --- quota ----------------------------------------------------------------
		async quotas(): Promise<QuotaAccount[]> {
			const j = await unwrap<{ accounts: QuotaAccount[] }>(await doFetch('/api/v1/quota'));
			return j.accounts ?? [];
		},
		async rotateQuota(account: string, toAccount: string): Promise<void> {
			await unwrap(
				await doFetch(`${quotaPath(account)}/rotate`, {
					...JSON_POST,
					body: JSON.stringify({ to_account: toAccount })
				})
			);
		},
		// Web onboarding (hq-quota-onboard-web): drive the real `claude auth login` lifecycle on the
		// gt-orch-server daemon (a HOST process behind Traefik at /api/v1/quota/onboard/*). `start`
		// spawns the login and returns the URL the human visits; `complete` hands back the OOB code,
		// and the daemon captures the account email + registers it. Use the BROWSER fetcher: the SSR
		// client targets gt-mcp-server, which does not carry these daemon routes.
		async onboardStart(): Promise<OnboardStart> {
			return unwrap<OnboardStart>(await doFetch('/api/v1/quota/onboard/start', JSON_POST));
		},
		async onboardComplete(sessionId: string, code: string): Promise<OnboardComplete> {
			return unwrap<OnboardComplete>(
				await doFetch('/api/v1/quota/onboard/complete', {
					...JSON_POST,
					body: JSON.stringify({ session_id: sessionId, code })
				})
			);
		},
		// Per-account credential health (gtcore-1fe9b4). The keychain dirs live on the gt-orch-server
		// host, so — like onboarding — this is served by the daemon behind Traefik, not gt-mcp-server:
		// use the BROWSER fetcher. Degrades to an empty list if the route is not yet deployed.
		async quotaHealth(): Promise<CredHealth[]> {
			const j = await unwrap<{ accounts: CredHealth[] }>(await doFetch('/api/v1/quota/cred-health'));
			return j.accounts ?? [];
		},
		// Relogin lifecycle (gtcore-1fe9b4): re-runs `claude /login` against the account's existing
		// keychain dir and reseeds onboarding-complete so the sling consumes it pre-authed. Mirrors the
		// onboard flow (start → human visits URL → complete with the OOB code); daemon route, browser
		// fetcher. The account rides in the `start` body and is carried by the returned session.
		async reloginStart(account: string): Promise<ReloginStart> {
			return unwrap<ReloginStart>(
				await doFetch('/api/v1/quota/relogin/start', {
					...JSON_POST,
					body: JSON.stringify({ account })
				})
			);
		},
		async reloginComplete(sessionId: string, code: string): Promise<ReloginComplete> {
			return unwrap<ReloginComplete>(
				await doFetch('/api/v1/quota/relogin/complete', {
					...JSON_POST,
					body: JSON.stringify({ session_id: sessionId, code })
				})
			);
		},
		// Retire an account from the rotation pool. Emits AccountDeregistered; idempotent.
		async retireQuota(account: string): Promise<void> {
			await unwrap(await doFetch(quotaPath(account), { method: 'DELETE' }));
		},
		async syncProbeQuotas(): Promise<{ ok: boolean; probed: number }> {
			return unwrap<{ ok: boolean; probed: number }>(
				await doFetch('/api/v1/quota/probe/sweep', JSON_POST)
			);
		},
		/** All quota.window_reset.v1 payloads for this workspace, in log order.
		 *  The REST surface serializes each record as the externally-tagged QuotaEvent enum
		 *  (`{"WindowReset": {...}}`) — unwrap the tag, tolerating an already-flat record. */
		async quotaHistory(): Promise<WindowReset[]> {
			const j = await unwrap<{ resets: Array<WindowReset | { WindowReset: WindowReset }> }>(
				await doFetch('/api/v1/quota/history')
			);
			return (j.resets ?? []).map((r) => ('WindowReset' in r ? r.WindowReset : r));
		},
		/** All quota.tokens_sampled.v1 payloads for this workspace, in log order.
		 *  Same externally-tagged shape as quotaHistory (`{"TokensSampled": {...}}`). */
		async quotaTokens(): Promise<TokenSample[]> {
			const j = await unwrap<{ samples: Array<TokenSample | { TokensSampled: TokenSample }> }>(
				await doFetch('/api/v1/quota/tokens')
			);
			return (j.samples ?? []).map((s) => ('TokensSampled' in s ? s.TokensSampled : s));
		}
	};
}

/** Browser-side admin client: relative paths, same-origin cookies via the proxy. */
export function browserAdmin() {
	return admin((path, init) => fetch(path, { credentials: 'same-origin', ...init }));
}
