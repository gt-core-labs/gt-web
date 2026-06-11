/**
 * VCS-connection client for the `connection.*` REST surface (epic hq-vcs-connections).
 *
 * A connection belongs to a workspace and is how a rig is cloned without storing a
 * long-lived token: either a GitHub App installation (`github_app`, zero token at
 * rest — installation tokens are minted JIT server-side) or a Personal Access Token
 * fallback (`pat`, sealed AES-GCM at rest, never returned). The read projection
 * therefore NEVER carries the secret — only `has_secret` reports whether a PAT is
 * stored (mirrors `$lib/api/auth` providers).
 *
 * CRUD routes (relative; nested under `/api/v1/connection`, NO trailing slash on the
 * list/create root which is the bare `/api/v1/connection`): GET/POST `/api/v1/connection`,
 * GET/PATCH/DELETE `/api/v1/connection/:id`. Reads need `connection.read`, writes
 * `connection.write`.
 *
 * The GitHub App helper routes (hq-vcs-connections.2) live under
 * `/api/v1/connection/github/*`: GET `/install` (302 redirect to the App install page),
 * GET `/callback` (captures installation_id → persists a `github_app` connection), and
 * GET `/repos` (lists the installation's repositories via a JIT token). The install flow
 * is a browser navigation (a redirect), not a fetch; `repos` is a JSON fetch. These land
 * with the backend bead .2 — until then they 404 and the page degrades to PAT-only.
 *
 * `connection(fetcher)` is transport-agnostic: pass a browser fetcher (relative,
 * same-origin cookies) or a server one (absolute backend + forwarded cookie).
 */
import { TrackerError, type Fetcher } from './tracker';

/** The connection variant. `github_app` stores no secret; `pat` seals one at rest. */
export type ConnectionKind = 'github_app' | 'pat';

/** Lifecycle state of a connection. */
export type ConnectionStatus = 'active' | 'disabled' | 'revoked';

/**
 * A connection as returned by every read — the projection that OMITS the sealed secret.
 * `has_secret` reports WHETHER a PAT is stored without revealing it.
 */
export interface Connection {
	id: string;
	/** Owning workspace; `null` = a global connection. */
	workspace_id: string | null;
	kind: string;
	/** GitHub App installation id (`github_app` only). */
	installation_id: string | null;
	/** GitHub account/org login (`github_app` only). */
	account_login: string | null;
	/** Whether a sealed PAT is stored (the secret itself is never returned). */
	has_secret: boolean;
	status: string;
	/** Creation time (epoch seconds). */
	created_at: number;
}

/** `POST /api/v1/connection` body. `workspace_id` is NOT sent — the backend takes it from auth. */
export interface CreateConnectionBody {
	id: string;
	kind: ConnectionKind;
	installation_id?: string;
	account_login?: string;
	/** The PAT, cleartext on the wire; sealed at rest, never returned (`pat` only). */
	secret?: string;
	status?: ConnectionStatus;
}

/**
 * One repository from `GET /api/v1/connection/github/repos`. The backend surfaces the
 * GitHub `GET /installation/repositories` shape; the FE needs the clone URL + a label.
 */
export interface GithubRepo {
	/** `owner/name`, the display label and stable key. */
	full_name: string;
	/** The clone URL to write into the rig's `git_url`. */
	clone_url: string;
	/** Whether the repo is private (a chip hint). */
	private?: boolean;
	/** The repo's default branch, if the backend reports it. */
	default_branch?: string;
}

/**
 * The secret-free view of the platform GitHub App config (hq-61ea43),
 * `GET /api/v1/connection/github/config`. The private key + webhook secret are never
 * returned — only whether each is set.
 */
export interface GithubAppConfigView {
	app_id: string;
	app_slug: string;
	has_private_key: boolean;
	has_webhook_secret: boolean;
}

/**
 * `PUT /api/v1/connection/github/config` body. `private_key_pem` / `webhook_secret` are
 * WRITE-ONLY: supply to set/rotate, omit to keep. The private key is required on first configure.
 */
export interface GithubAppConfigInput {
	app_id: string;
	app_slug: string;
	private_key_pem?: string;
	webhook_secret?: string;
}

const JSON_POST = { method: 'POST', headers: { 'content-type': 'application/json' } } as const;

async function unwrap<T>(res: Response): Promise<T> {
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new TrackerError(res.status, text || res.statusText);
	}
	return (await res.json()) as T;
}

export function connection(doFetch: Fetcher) {
	const path = (id: string) => `/api/v1/connection/${encodeURIComponent(id)}`;
	return {
		/** Every connection visible to the workspace (own + global). */
		async list(): Promise<Connection[]> {
			// The backend returns a bare array (ConnectionView[]), not an envelope.
			return unwrap<Connection[]>(await doFetch('/api/v1/connection'));
		},
		async create(body: CreateConnectionBody): Promise<Connection> {
			return unwrap<Connection>(
				await doFetch('/api/v1/connection', { ...JSON_POST, body: JSON.stringify(body) })
			);
		},
		async remove(id: string): Promise<void> {
			const res = await doFetch(path(id), { method: 'DELETE' });
			if (!res.ok) {
				const text = await res.text().catch(() => '');
				throw new TrackerError(res.status, text || res.statusText);
			}
		},
		/**
		 * List the GitHub App installation's repositories (hq-vcs-connections.2). Throws a
		 * {@link TrackerError} with status 404 until the backend bead lands — callers degrade
		 * to the free-text git_url fallback in that case.
		 */
		async githubRepos(): Promise<GithubRepo[]> {
			return unwrap<GithubRepo[]>(await doFetch('/api/v1/connection/github/repos'));
		},
		/**
		 * The platform GitHub App config (hq-61ea43), secret-free. `null` when no App is configured
		 * yet (the backend answers 404) so the page shows the "configure" form.
		 */
		async githubConfig(): Promise<GithubAppConfigView | null> {
			const res = await doFetch('/api/v1/connection/github/config');
			if (res.status === 404) return null;
			return unwrap<GithubAppConfigView>(res);
		},
		/** Upsert the platform GitHub App config (hq-61ea43). Secrets write-only (omit to keep). */
		async setGithubConfig(body: GithubAppConfigInput): Promise<void> {
			const res = await doFetch('/api/v1/connection/github/config', {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			});
			if (!res.ok) {
				const text = await res.text().catch(() => '');
				throw new TrackerError(res.status, text || res.statusText);
			}
		}
	};
}

/** Browser-side connection client: relative paths, same-origin cookies via the proxy. */
export function browserConnection() {
	return connection((p, init) => fetch(p, { credentials: 'same-origin', ...init }));
}

/**
 * The browser URL that kicks off the GitHub App install flow (hq-vcs-connections.2).
 * It is a top-level navigation (the backend 302-redirects to the App install page),
 * NOT a fetch — assign it to `window.location`.
 */
export const GITHUB_INSTALL_URL = '/api/v1/connection/github/install';
