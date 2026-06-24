/**
 * Domain-catalog client for the gt-meta `domain` REST module (`gtweb-855bac`,
 * UI half of H4 / gtcore-b37400). The catalog is per-workspace EDITABLE data
 * (the backend resolves the ACTIVE workspace's Dolt store), so every route is
 * scoped: GET needs `domain.read`, the mutations need `domain.write`.
 *
 * Routes under `/api/v1/domain` (NO trailing slash — a slash 404s and the SSR
 * loader turns that into a 500, exactly like the admin / tracker surfaces):
 *  - GET    /api/v1/domain/catalog        (domain.read)  -> [{ key, label, tier, enabled, reserved }]
 *  - POST   /api/v1/domain/catalog        (domain.write) -> add        (CatalogAdd body)
 *  - PATCH  /api/v1/domain/catalog/{key}  (domain.write) -> rename / set-enabled (CatalogPatch body)
 *  - DELETE /api/v1/domain/catalog/{key}  (domain.write) -> remove
 *
 * `meta.gap` is RESERVED: the backend rejects an edit/delete of it. The list
 * carries `reserved: true` for such entries so the UI can lock the controls
 * rather than letting the mutation round-trip and fail.
 *
 * `domainCatalog(fetcher)` is transport-agnostic: pass a browser fetcher
 * (relative, same-origin cookies) or a server one (absolute backend + cookie).
 */
import { TrackerError, type Fetcher } from './tracker';

/** One row of the workspace domain catalog. Mirrors the backend JSON exactly. */
export interface DomainCatalogEntry {
	/** The stable domain key beads carry (e.g. `producto`, `orch.merge`). */
	key: string;
	/** Display label; defaults to the key when none was set. */
	label: string;
	/** Optional coarse tier; `null` for a flat business domain. */
	tier: string | null;
	/** Whether the domain may be applied to new beads. */
	enabled: boolean;
	/** Reserved domains (`meta.gap`) can't be edited or deleted. */
	reserved: boolean;
}

/** `POST /api/v1/domain/catalog` body. Only `key` is required. */
export interface DomainCatalogAdd {
	key: string;
	label?: string;
	tier?: string;
}

/** `PATCH /api/v1/domain/catalog/{key}` body — a partial edit (rename / set-enabled). */
export interface DomainCatalogPatch {
	label?: string;
	enabled?: boolean;
}

/**
 * Coerce a catalog response into a clean entry array. The route returns a bare
 * `[{...}]`; we also unwrap a `{ domains | catalog | entries: [...] }` envelope
 * defensively, and drop anything without a string `key`, so a malformed body
 * degrades to `[]` instead of throwing in the render.
 */
export function parseDomainCatalog(raw: unknown): DomainCatalogEntry[] {
	const arr = Array.isArray(raw)
		? raw
		: raw && typeof raw === 'object'
			? ((raw as Record<string, unknown>).domains ??
				(raw as Record<string, unknown>).catalog ??
				(raw as Record<string, unknown>).entries)
			: undefined;
	if (!Array.isArray(arr)) return [];
	const out: DomainCatalogEntry[] = [];
	for (const v of arr) {
		if (!v || typeof v !== 'object') continue;
		const o = v as Record<string, unknown>;
		if (typeof o.key !== 'string' || o.key.length === 0) continue;
		out.push({
			key: o.key,
			label: typeof o.label === 'string' && o.label.length > 0 ? o.label : o.key,
			tier: typeof o.tier === 'string' && o.tier.length > 0 ? o.tier : null,
			enabled: o.enabled !== false,
			reserved: o.reserved === true
		});
	}
	return out;
}

/**
 * The enabled domain keys, sorted — the closed set the CreateIssueModal selector
 * offers (gtweb-186fbf). Disabled/removed domains are excluded because the
 * backend's H2 validation rejects them for new beads, so offering one would only
 * produce a submit error.
 */
export function enabledDomainKeys(entries: DomainCatalogEntry[]): string[] {
	return entries
		.filter((e) => e.enabled)
		.map((e) => e.key)
		.sort();
}

async function unwrap<T>(res: Response): Promise<T> {
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new TrackerError(res.status, text || res.statusText);
	}
	return (await res.json()) as T;
}

const CATALOG = '/api/v1/domain/catalog';
const JSON_HEADERS = { 'content-type': 'application/json' } as const;

export function domainCatalog(doFetch: Fetcher) {
	const keyPath = (key: string) => `${CATALOG}/${encodeURIComponent(key)}`;
	return {
		/** The active workspace's catalog. Requires `domain.read`. */
		async list(): Promise<DomainCatalogEntry[]> {
			return parseDomainCatalog(await unwrap<unknown>(await doFetch(CATALOG)));
		},
		/** Add a domain. Requires `domain.write`; a duplicate key is rejected backend-side. */
		async add(body: DomainCatalogAdd): Promise<void> {
			await unwrap(
				await doFetch(CATALOG, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) })
			);
		},
		/** Rename and/or set-enabled. Requires `domain.write`; reserved keys are rejected. */
		async patch(key: string, body: DomainCatalogPatch): Promise<void> {
			await unwrap(
				await doFetch(keyPath(key), {
					method: 'PATCH',
					headers: JSON_HEADERS,
					body: JSON.stringify(body)
				})
			);
		},
		/** Remove a domain. Requires `domain.write`; reserved keys are rejected. */
		async remove(key: string): Promise<void> {
			await unwrap(await doFetch(keyPath(key), { method: 'DELETE' }));
		}
	};
}

/** Browser-side domain-catalog client: relative paths, same-origin cookies. */
export function browserDomain() {
	return domainCatalog((path, init) => fetch(path, { credentials: 'same-origin', ...init }));
}
