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
import { parseDomainCatalog, enabledDomainKeys } from './domain';

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
		 * The ACTIVE workspace's enabled domain keys, for the CreateIssueModal selector
		 * (gtweb-855bac). Sourced from the workspace's editable catalog via
		 * `GET /api/v1/meta/domains` — NOT the closed Rust `Domain` enum — so a domain
		 * added through the `/system` admin table shows up with no frontend edit, and a
		 * disabled one is excluded (the backend's H2 validation would reject it anyway).
		 * Requires scope `meta.read`; callers should treat a reject (or an un-seeded
		 * workspace's empty list) as "no catalog" and degrade to a free-text fallback.
		 */
		async domains(): Promise<string[]> {
			return enabledDomainKeys(parseDomainCatalog(await unwrap<unknown>(await doFetch('/api/v1/meta/domains'))));
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
