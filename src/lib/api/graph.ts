/**
 * Knowledge-graph client for the `graph.*` REST surface (epic hq-vcs-connections.9).
 *
 * A rig's codebase knowledge graph is built + kept fresh by the graph warden. This client reads its
 * per-rig freshness (for the per-repo chip in the GitHub complemento) and triggers a rebuild (the
 * "Refresh" button). The backend mounts the read-only `graph.*` REST routes (`gt_graphindex::http`,
 * the `axum` feature) under `/api/v1/graph`, dispatching to the SAME warden custody the MCP
 * `graph.list`/`graph.status` tools fold — so freshness is sourced from the warden's
 * `last_indexed_commit` + `stale`, never the always-null indexer metadata (the .9 finding).
 *
 *   GET  /api/v1/graph            → every rig under custody with its freshness (`graph.list`)
 *   GET  /api/v1/graph/:rig       → one rig's freshness + index stats (`graph.status`)
 *   POST /api/v1/graph/:rig/refresh → rebuild that rig's graph (`graph.refresh`)
 *
 * Reads need `graph.read`; the refresh write needs `graph.write`. These routes mount only when the
 * backend has `GT_PG_URL` (the warden custody + rig catalog backing); a backend that predates this
 * bead 404s and the caller degrades to a `—` chip.
 *
 * `graphClient(fetcher)` is transport-agnostic: pass a browser fetcher (relative, same-origin
 * cookies) or a server one (absolute backend + forwarded cookie).
 */
import { TrackerError, type Fetcher } from './tracker';

/**
 * The freshness state of a rig's graph, derived purely from the warden custody (so it is the same
 * over MCP + REST): `built` = current, `behind` = a graph was indexed but origin moved past it,
 * `stale` = registered but never indexed (the initial build is owed).
 */
export type GraphState = 'built' | 'behind' | 'stale';

/** One rig's graph freshness + index size, as `GET /api/v1/graph/:rig` returns it. */
export interface GraphStatus {
	/** Whether a graph artifact currently exists for the rig. */
	built: boolean;
	/** The tool that produced it (e.g. `graphify`). */
	tool: string;
	/** Node count, if built. */
	nodes: number | null;
	/** Edge count, if built. */
	edges: number | null;
	/** Community count, if built. */
	communities: number | null;
	/** The commit the graph was last indexed at (from the warden custody), or null if never. */
	last_indexed_commit: string | null;
	/** Back-compat alias of `last_indexed_commit`. */
	built_at_commit: string | null;
	/** Whether the warden marked the graph stale. */
	stale: boolean;
	/** Changed files pending since the last index. */
	pending_changes: number;
	/** The freshness state the chip renders. */
	state: GraphState;
}

/** One rig under warden custody, as `GET /api/v1/graph` lists it. */
export interface GraphCustody {
	rig: string;
	repo_dir: string;
	stale: boolean;
	pending_changes: number;
	last_indexed_commit: string | null;
}

/** The result of `POST /api/v1/graph/:rig/refresh`. */
export interface GraphRefreshResult {
	ok: boolean;
	rig: string;
	repo_dir?: string;
	commit?: string;
	nodes?: number;
	edges?: number;
	communities?: number;
}

async function unwrap<T>(res: Response): Promise<T> {
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new TrackerError(res.status, text || res.statusText);
	}
	return (await res.json()) as T;
}

export function graphClient(doFetch: Fetcher) {
	const rigPath = (rig: string) => `/api/v1/graph/${encodeURIComponent(rig)}`;
	return {
		/** Every rig under warden custody with its freshness (`graph.list`). */
		async list(): Promise<GraphCustody[]> {
			const j = await unwrap<{ rigs: GraphCustody[] }>(await doFetch('/api/v1/graph'));
			return j.rigs ?? [];
		},
		/** One rig's freshness + index stats (`graph.status`); 404 when not under custody. */
		async status(rig: string): Promise<GraphStatus> {
			return unwrap<GraphStatus>(await doFetch(rigPath(rig)));
		},
		/** Rebuild a rig's graph (`graph.refresh`); needs `graph.write`. */
		async refresh(rig: string): Promise<GraphRefreshResult> {
			return unwrap<GraphRefreshResult>(
				await doFetch(`${rigPath(rig)}/refresh`, { method: 'POST' })
			);
		}
	};
}

/** Browser-side graph client: relative paths, same-origin cookies via the proxy. */
export function browserGraph() {
	return graphClient((p, init) => fetch(p, { credentials: 'same-origin', ...init }));
}
