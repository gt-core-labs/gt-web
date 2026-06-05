/**
 * Documents client for /api/v1/documents (no trailing slash; codegen has no
 * bodies). Hand-typed against gt-documents.
 *
 * Note: `list` requires BOTH owner_type + owner_id — there is no flat browse-all
 * yet (backend bead hq-web-extras.11), so the Knowledge UI is search-driven.
 */
import { TrackerError, type Fetcher } from './tracker';

export type DocOwnerType = 'epic' | 'skill' | 'spec';
export type DocKind = 'md' | 'blob';

export interface DocumentRow {
	id: string;
	owner_type: string;
	owner_id: string;
	kind: string;
	filename: string;
	content_type: string | null;
	size: number | null;
	sha256: string | null;
	body_md: string | null;
	extracted_text: string | null;
	bucket: string | null;
	key: string | null;
	version: number;
	deleted_at: string | null;
	uploaded_by: string | null;
	uploaded_at: string;
}

export interface SearchQuery {
	query: string;
	owner_type?: string;
	owner_id?: string;
	limit?: number;
}

export interface AttachDocBody {
	owner_type: string;
	owner_id: string;
	kind: DocKind;
	filename: string;
	created_by: string;
	content_type?: string;
	body_md?: string;
	data_base64?: string;
}

export interface UpdateDocBody {
	expected_version: number;
	edited_by: string;
	filename?: string;
	body_md?: string;
}

const JSON_HEADERS = { 'content-type': 'application/json' } as const;

async function unwrap<T>(res: Response): Promise<T> {
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new TrackerError(res.status, text || res.statusText);
	}
	return (await res.json()) as T;
}

export function documents(doFetch: Fetcher) {
	const path = (id: string) => `/api/v1/documents/${encodeURIComponent(id)}`;
	return {
		async search(q: SearchQuery): Promise<DocumentRow[]> {
			const qs = new URLSearchParams({ query: q.query });
			if (q.owner_type) qs.set('owner_type', q.owner_type);
			if (q.owner_id) qs.set('owner_id', q.owner_id);
			if (q.limit) qs.set('limit', String(q.limit));
			const j = await unwrap<{ documents: DocumentRow[] }>(
				await doFetch(`/api/v1/documents/search?${qs}`)
			);
			return j.documents ?? [];
		},
		async listByOwner(owner_type: string, owner_id: string): Promise<DocumentRow[]> {
			const qs = new URLSearchParams({ owner_type, owner_id });
			const j = await unwrap<{ documents: DocumentRow[] }>(
				await doFetch(`/api/v1/documents?${qs}`)
			);
			return j.documents ?? [];
		},
		async get(id: string): Promise<DocumentRow> {
			return unwrap(await doFetch(path(id)));
		},
		async attach(body: AttachDocBody): Promise<DocumentRow> {
			return unwrap(
				await doFetch('/api/v1/documents', {
					method: 'POST',
					headers: JSON_HEADERS,
					body: JSON.stringify(body)
				})
			);
		},
		async update(id: string, patch: UpdateDocBody): Promise<DocumentRow> {
			return unwrap(
				await doFetch(path(id), {
					method: 'PATCH',
					headers: JSON_HEADERS,
					body: JSON.stringify(patch)
				})
			);
		},
		async remove(id: string, expectedVersion: number): Promise<void> {
			await unwrap(
				await doFetch(`${path(id)}?expected_version=${expectedVersion}`, { method: 'DELETE' })
			);
		}
	};
}

export function browserDocs() {
	return documents((path, init) => fetch(path, { credentials: 'same-origin', ...init }));
}
