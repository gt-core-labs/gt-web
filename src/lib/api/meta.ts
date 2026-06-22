/**
 * Meta client for the gt-meta domain (`hq-fe-domains.2`).
 *
 * Two routes under `/api/v1/meta` (NO trailing slash — a slash 404s and the SSR
 * loader turns that into a 500, exactly like the admin / tracker surfaces):
 *  - GET  /api/v1/meta/help        (scope meta.read)  -> { tools: [...] }
 *  - POST /api/v1/meta/report-gap  (scope meta.write) -> 201, echoes the bead
 *
 * `meta(fetcher)` is transport-agnostic: pass a browser fetcher (relative,
 * same-origin cookies) or a server one (absolute backend + forwarded cookie).
 */
import { TrackerError, type Fetcher } from './tracker';

/** A single entry in the help catalog. `inputSchema` is a raw JSON Schema. */
export interface HelpTool {
	name: string;
	description: string;
	inputSchema?: unknown;
}

/**
 * One grantable scope in the discovery catalog (`hq-scope-catalog`): a `<namespace>.<verb>` scope
 * with a backend-derived human label and its owning namespace. The token-permission picker reads
 * these instead of a hardcoded label map, so a newly-registered backend namespace appears with no
 * frontend edit.
 */
export interface ScopeCatalogEntry {
	scope: string;
	label: string;
	namespace: string;
}

/** `GET /api/v1/meta/scopes` body. */
export interface ScopesResponse {
	scopes: ScopeCatalogEntry[];
}

/** `GET /api/v1/meta/help` body. The catalog shape is dynamic — render defensively. */
export interface HelpResponse {
	tools: HelpTool[];
}

/**
 * Pull the closed Domain set out of a help catalog.
 *
 * The backend (gt-issues) models `domain` as a closed Rust enum and exposes it
 * in the `issues.create`/`issues.update` tool schemas as a JSON-Schema
 * `definitions.Domain` — a `oneOf` of single-value `enum` branches (one branch
 * per `#[serde(rename)]` variant; schemars splits documented variants into their
 * own branch). We union every branch's `enum`, so a newly-registered domain
 * appears in the picker with NO frontend edit — the whole point of sourcing the
 * set from the backend instead of hardcoding it (gtweb-186fbf). Returns `[]`
 * when the catalog doesn't carry the definition (e.g. caller lacks `meta.read`).
 */
export function domainsFromCatalog(tools: HelpTool[]): string[] {
	const out = new Set<string>();
	const collect = (node: unknown) => {
		if (!node || typeof node !== 'object') return;
		const o = node as Record<string, unknown>;
		if (Array.isArray(o.enum)) for (const v of o.enum) if (typeof v === 'string') out.add(v);
		for (const key of ['oneOf', 'anyOf', 'allOf'] as const) {
			if (Array.isArray(o[key])) for (const branch of o[key] as unknown[]) collect(branch);
		}
	};
	for (const t of tools) {
		const schema = t.inputSchema as { definitions?: Record<string, unknown> } | undefined;
		const def = schema?.definitions?.Domain;
		if (def) collect(def);
	}
	return [...out].sort();
}

/** `POST /api/v1/meta/report-gap` body. Only `operation` is required. */
export interface ReportGapBody {
	operation: string;
	notes?: string;
	priority?: number;
	external_ref?: string;
	surface?: string[];
	domain?: string[];
	depends_on?: string[];
}

/** `POST /api/v1/meta/report-gap` 201 response — echoes the minted bead. */
export interface ReportGapResult {
	bead: string;
	operation: string;
	priority?: number;
	external_ref?: string;
}

const JSON_POST = { method: 'POST', headers: { 'content-type': 'application/json' } } as const;

async function unwrap<T>(res: Response): Promise<T> {
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new TrackerError(res.status, text || res.statusText);
	}
	return (await res.json()) as T;
}

export function meta(doFetch: Fetcher) {
	return {
		/** The operation catalog. Returns a safe empty list if the body is malformed. */
		async help(): Promise<HelpTool[]> {
			const j = await unwrap<HelpResponse>(await doFetch('/api/v1/meta/help'));
			return Array.isArray(j?.tools) ? j.tools : [];
		},
		/**
		 * The closed Domain set for the bead `domain` field, derived from the help
		 * catalog's `issues.create` schema (see {@link domainsFromCatalog}). Sourced
		 * from the backend so the CreateIssueModal selector can't offer (or submit) an
		 * out-of-set value. Requires scope `meta.read`; callers should treat a reject
		 * as "no catalog" and degrade to a free-text fallback (gtweb-186fbf).
		 */
		async domains(): Promise<string[]> {
			const j = await unwrap<HelpResponse>(await doFetch('/api/v1/meta/help'));
			return domainsFromCatalog(Array.isArray(j?.tools) ? j.tools : []);
		},
		/**
		 * The grantable scope catalog (`hq-scope-catalog`): every `<namespace>.<verb>` scope a token
		 * may be granted, derived backend-side from the closed verb vocabulary × the registered
		 * namespaces. Returns a safe empty list if the body is malformed. Requires scope `meta.read`.
		 */
		async scopes(): Promise<ScopeCatalogEntry[]> {
			const j = await unwrap<ScopesResponse>(await doFetch('/api/v1/meta/scopes'));
			return Array.isArray(j?.scopes) ? j.scopes : [];
		},
		/** File a missing-operation gap; the backend mints a `hq-gap-*` bead. */
		async reportGap(body: ReportGapBody): Promise<ReportGapResult> {
			return unwrap<ReportGapResult>(
				await doFetch('/api/v1/meta/report-gap', { ...JSON_POST, body: JSON.stringify(body) })
			);
		}
	};
}
