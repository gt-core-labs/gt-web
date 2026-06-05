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
	now_secs: number;
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
		async rotateQuota(account: string): Promise<void> {
			await unwrap(await doFetch(`${quotaPath(account)}/rotate`, { ...JSON_POST, body: '{}' }));
		},
		async probeQuota(account: string): Promise<void> {
			await unwrap(await doFetch(`${quotaPath(account)}/probe`, { ...JSON_POST, body: '{}' }));
		}
	};
}

/** Browser-side admin client: relative paths, same-origin cookies via the proxy. */
export function browserAdmin() {
	return admin((path, init) => fetch(path, { credentials: 'same-origin', ...init }));
}
