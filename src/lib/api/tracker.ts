/**
 * Tracker client for the backend `/api/v1/issues` surface.
 *
 * The OpenAPI spec carries no request/response *bodies* for these routes (thin
 * utoipa annotations: `content: never`), so the codegen in `schema.d.ts` cannot
 * type them — the shapes below are maintained by hand against the live API and
 * the gt-issues command structs. Note the routes have NO trailing slash
 * (`/api/v1/issues`, not `/issues/` — the latter 404s).
 *
 * `tracker(fetcher)` is transport-agnostic: pass a browser fetcher (relative,
 * same-origin cookies) or a server one (absolute backend + forwarded cookie).
 */

export type IssueStatus = 'open' | 'working' | 'closed';

/**
 * The closed `issue_type` set the backend accepts on create/update (hq-48ca5c —
 * `IssueType` enum in gt-issues). Legacy rows may carry other strings; the read
 * path stays `string`, but every type *editor* must offer exactly this set.
 */
export const ISSUE_TYPES = ['epic', 'task', 'bug', 'spike', 'chore', 'feature'] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

/**
 * Event kinds the backend emits on `/stream?channel=issues` (the SSE feed every
 * issue mutation — REST or MCP — publishes into). The names carry the `.v1`
 * version suffix exactly as the stream frames them, so an `EventSource` listener
 * must subscribe by these literal names (it never fires `onmessage` for a *named*
 * event). Mirrors `ORCH_EVENT_KINDS` in `./orch`.
 */
export const ISSUE_EVENT_KINDS = [
	'issues.created.v1',
	'issues.updated.v1',
	'issues.transitioned.v1',
	'issues.closed.v1',
	'issues.claimed.v1',
	// The agent operating a bead started / stopped (hq-agent-observability.2): the polecat
	// supervisor publishes these onto the same issues channel, so the board refreshes the
	// `operated_by` overlay live when an agent picks up or finishes a bead.
	'issues.operated.v1',
	'issues.operator-cleared.v1'
] as const;

/**
 * The agent currently operating a bead (hq-agent-observability.3), inlined on a row as
 * `operated_by` by the issues REST read when a polecat is slung for it. Ephemeral runtime state —
 * absent (the field omitted / null) when no agent is on the bead.
 */
export interface IssueOperator {
	/** The agent session id (its tmux session, `<prefix>-<bead>`). */
	session: string;
	/** The session role (`polecat` / `witness` / …). */
	role: string;
	/** Skills the agent has loaded (from its worktree `.claude/skills`). */
	skills: string[];
	/** Hook kinds loaded into the agent (`SessionStart` / `Stop` / …). */
	hooks: string[];
}

/** A tracker row as returned by the list endpoint (no heavy text bodies). */
export interface IssueRow {
	id: string;
	title: string;
	status: IssueStatus;
	priority: number;
	issue_type: string;
	assignee: string | null;
	owner: string;
	created_at: string;
	updated_at: string;
	closed_at: string | null;
	external_ref: string | null;
	spec_id: string | null;
	/** JSON-encoded string arrays / objects as persisted by the store. */
	domain_json: string;
	surface_json: string;
	depends_on_json: string;
	role_scope: string | null;
	version: number;
	phase: string | null;
	delivered_sha: string | null;
	/** The agent operating this bead right now (hq-agent-observability.3); absent when none is. */
	operated_by?: IssueOperator | null;
	/** Board project key (hq-62130a (rig, workspace) scope); legacy rows = `default`. */
	workspace?: string;
	/** Lexorank intra-column order (hq-62130a); `''` = unranked tail. */
	board_rank?: string;
	/** Planning fields (hq-62130a): mockup Horas Est. / Fecha Inicio / Fecha Fin. */
	estimated_hours?: number | null;
	start_date?: string | null;
	due_date?: string | null;
}

/** A full issue (list row + the heavy text bodies), from GET /api/v1/issues/{id}. */
export interface IssueDetail extends IssueRow {
	description: string;
	design: string;
	acceptance_criteria: string;
	notes: string;
}

export interface IssuePage {
	rows: IssueRow[];
	total: number;
	next_offset: number | null;
	has_more: boolean;
}

export interface ListQuery {
	status?: string;
	priority_max?: number;
	assignee?: string;
	external_ref?: string;
	issue_type?: string;
	limit?: number;
	offset?: number;
	full?: boolean;
	/** Narrow to a single rig (hq-rig-isolation.1). Absent ⇒ workspace-wide. */
	rig?: string;
	/** Narrow to one board project (hq-62130a (rig, workspace) scope key). */
	workspace?: string;
}

export interface CreateIssueBody {
	/** Omit to let the server generate `{rig}-{6hex}` (hq-bead-id-standard.1). */
	id?: string;
	/** Required when `id` is absent — the namespace the generated id is prefixed with. */
	rig?: string;
	/** Board project the card lands in (hq-62130a); absent ⇒ `default`. */
	workspace?: string;
	title: string;
	issue_type: string;
	created_by: string;
	description?: string;
	design?: string;
	acceptance_criteria?: string;
	notes?: string;
	priority?: number;
	external_ref?: string;
	assignee?: string;
	owner?: string;
	/** Closed-set domains (≥1 required for non-epic), e.g. ["fe.web"]. */
	domain?: string[];
	depends_on?: string[];
	role_scope?: string;
	phase?: string;
}

export interface UpdateIssueBody {
	title?: string;
	description?: string;
	design?: string;
	acceptance_criteria?: string;
	notes?: string;
	priority?: number;
	issue_type?: string;
	assignee?: string;
	/** Epic linkage (the sub-epic this bead belongs to). */
	external_ref?: string;
	/** Forward dependency edges — FULL replacement of the list. */
	depends_on?: string[];
	/** Board workspace re-scope (hq-62130a) — `archive` hides the card from the
	 * default board/planning views (manual archiving, hq-039316). */
	workspace?: string;
	/** Optimistic concurrency: rejected with 422 if the row moved on. */
	expected_version?: number;
	/** Planning fields (hq-62130a): mockup Horas Est. / Fecha Inicio / Fecha Fin. */
	estimated_hours?: number;
	/** `YYYY-MM-DD`; empty string clears. */
	start_date?: string;
	due_date?: string;
}

export interface CloseIssueBody {
	/** Required when the bead declares a non-planned code surface. */
	commit_sha?: string;
}

/** Error carrying the backend's plain-text reason + HTTP status. */
export class TrackerError extends Error {
	constructor(
		public status: number,
		message: string
	) {
		super(message);
		this.name = 'TrackerError';
	}
}

export type Fetcher = (path: string, init?: RequestInit) => Promise<Response>;

const JSON_POST = { method: 'POST', headers: { 'content-type': 'application/json' } } as const;

async function unwrap<T>(res: Response): Promise<T> {
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new TrackerError(res.status, text || res.statusText);
	}
	return (await res.json()) as T;
}

export function tracker(doFetch: Fetcher) {
	const issuePath = (id: string) => `/api/v1/issues/${encodeURIComponent(id)}`;
	return {
		async list(q: ListQuery = {}): Promise<IssuePage> {
			const qs = new URLSearchParams();
			for (const [k, v] of Object.entries(q)) {
				if (v !== undefined && v !== '') qs.set(k, String(v));
			}
			const s = qs.toString();
			return unwrap(await doFetch(`/api/v1/issues${s ? `?${s}` : ''}`));
		},
		async get(id: string): Promise<IssueDetail> {
			return unwrap(await doFetch(issuePath(id)));
		},
		async create(body: CreateIssueBody): Promise<{ ok: boolean; id: string }> {
			return unwrap(await doFetch('/api/v1/issues', { ...JSON_POST, body: JSON.stringify(body) }));
		},
		async update(id: string, patch: UpdateIssueBody): Promise<{ ok: boolean; version?: number }> {
			return unwrap(
				await doFetch(issuePath(id), {
					method: 'PATCH',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(patch)
				})
			);
		},
		async transition(id: string, target: IssueStatus): Promise<void> {
			await unwrap(
				await doFetch(`${issuePath(id)}/transition`, { ...JSON_POST, body: JSON.stringify({ target }) })
			);
		},
		async claim(id: string): Promise<{ outcome: string; owner: string; version?: number }> {
			return unwrap(await doFetch(`${issuePath(id)}/claim`, { ...JSON_POST, body: '{}' }));
		},
		async close(id: string, body: CloseIssueBody = {}): Promise<void> {
			await unwrap(await doFetch(`${issuePath(id)}/close`, { ...JSON_POST, body: JSON.stringify(body) }));
		}
	};
}

/** Browser-side tracker: relative paths, same-origin cookies routed by the proxy. */
export function browserTracker() {
	return tracker((path, init) => fetch(path, { credentials: 'same-origin', ...init }));
}

/** Parse a `*_json` column into a string array, tolerating malformed values. */
export function parseJsonArray(raw: string | null | undefined): string[] {
	if (!raw) return [];
	try {
		const v = JSON.parse(raw);
		return Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : (x?.path ?? String(x)))) : [];
	} catch {
		return [];
	}
}
