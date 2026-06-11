/**
 * Kanban board client (hq-95c2bb, epic hq-56b5ee) for the backend board +
 * comments + report surfaces:
 *
 * - `GET  /api/v1/board?rig&workspace[&epic&group_by&…]` — the board snapshot
 *   (columns ordered by lexorank `board_rank`; optional swimlanes).
 * - `POST /api/v1/board/move` / `/reorder` — drag-drop writes: a move is a
 *   status transition + rank set in ONE atomic Dolt commit; placement is by
 *   `after`/`before` NEIGHBOR CARD IDS (the server computes the rank).
 * - `GET/POST/PATCH/DELETE /api/v1/comments` — the card-drawer thread
 *   (threaded via `parent_id`; `@handle` notifies the member).
 * - `POST /api/v1/report/generate` — the operator spreadsheet (hq-fc7d6a).
 *
 * Live updates: subscribe `/stream?topic=board:{rig}:{workspace}` — the topic
 * delivers the rig's `issues.*` frames plus `comments.*` on its cards.
 *
 * Hand-typed against the gt-core handlers (the OpenAPI bodies are thin), same
 * discipline as `./tracker`.
 */

import type { Fetcher, IssueRow, IssueStatus } from './tracker';
import { TrackerError } from './tracker';

/** A board card: the tracker row plus the kanban columns (hq-62130a). */
export interface BoardCard extends IssueRow {
	workspace: string;
	board_rank: string;
	estimated_hours: number | null;
	start_date: string | null;
	due_date: string | null;
}

export interface BoardLane {
	/** Lane key: assignee, epic id, or priority (`"0"`…); `""` = ungrouped tail. */
	key: string;
	cards: BoardCard[];
}

export interface BoardColumn {
	status: IssueStatus;
	cards: BoardCard[];
	lanes?: BoardLane[] | null;
}

export interface BoardSnapshot {
	rig: string;
	workspace: string;
	columns: BoardColumn[];
	group_by?: string | null;
}

export type GroupBy = 'assignee' | 'epic' | 'priority';

export interface BoardQuery {
	rig: string;
	workspace: string;
	epic?: string;
	group_by?: GroupBy;
	assignee?: string;
	priority_max?: number;
	issue_type?: string;
}

export interface BoardMoveBody {
	id: string;
	rig: string;
	workspace: string;
	/** Target column — the same open/working/closed machine as the tracker. */
	column: IssueStatus;
	/** Place AFTER this card id (omit both to append at the bottom). */
	after?: string;
	/** Place BEFORE this card id. */
	before?: string;
}

export interface BoardReorderBody {
	id: string;
	rig: string;
	workspace: string;
	after?: string;
	before?: string;
}

/** One comment of a card|doc thread (comments.* tools over the bridge REST). */
export interface Comment {
	id: string;
	target_kind: 'card' | 'doc';
	target_id: string;
	author: string;
	body: string;
	parent_id: string | null;
	created_at: string;
	edited_at: string | null;
}

const JSON_POST = { method: 'POST', headers: { 'content-type': 'application/json' } } as const;

async function unwrap<T>(res: Response): Promise<T> {
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new TrackerError(res.status, text || res.statusText);
	}
	return (await res.json()) as T;
}

function qs(params: Record<string, string | number | undefined>): string {
	const q = new URLSearchParams();
	for (const [k, v] of Object.entries(params)) {
		if (v !== undefined && v !== '') q.set(k, String(v));
	}
	const s = q.toString();
	return s ? `?${s}` : '';
}

export function board(doFetch: Fetcher) {
	return {
		async snapshot(q: BoardQuery): Promise<BoardSnapshot> {
			return unwrap(await doFetch(`/api/v1/board${qs({ ...q })}`));
		},
		/** Column change + placement; returns the landing rank. */
		async move(body: BoardMoveBody): Promise<{ ok: boolean; rank: string }> {
			return unwrap(
				await doFetch('/api/v1/board/move', { ...JSON_POST, body: JSON.stringify(body) })
			);
		},
		/** Rank-only placement within the card's current column. */
		async reorder(body: BoardReorderBody): Promise<{ ok: boolean; rank: string }> {
			return unwrap(
				await doFetch('/api/v1/board/reorder', { ...JSON_POST, body: JSON.stringify(body) })
			);
		}
	};
}

export function comments(doFetch: Fetcher) {
	return {
		async list(target_kind: 'card' | 'doc', target_id: string): Promise<Comment[]> {
			const res = await doFetch(`/api/v1/comments${qs({ target_kind, target_id })}`);
			const body = await unwrap<{ comments: Comment[] }>(res);
			return body.comments;
		},
		async create(input: {
			target_kind: 'card' | 'doc';
			target_id: string;
			body: string;
			parent_id?: string;
		}): Promise<Comment> {
			return unwrap(
				await doFetch('/api/v1/comments', { ...JSON_POST, body: JSON.stringify(input) })
			);
		},
		async update(id: string, body: string): Promise<Comment> {
			return unwrap(
				await doFetch(`/api/v1/comments/${encodeURIComponent(id)}`, {
					method: 'PATCH',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ body })
				})
			);
		},
		async remove(id: string): Promise<void> {
			await unwrap(
				await doFetch(`/api/v1/comments/${encodeURIComponent(id)}`, { method: 'DELETE' })
			);
		}
	};
}

export interface ReportResult {
	ok: boolean;
	document_id: string;
	filename: string;
	format: string;
	sections: number;
	rows: number;
	total_horas: number;
	email_queued: boolean;
}

export function report(doFetch: Fetcher) {
	return {
		async generate(input: {
			rig: string;
			workspace: string;
			epic?: string;
			format?: 'xlsx' | 'csv';
			email_to?: string;
		}): Promise<ReportResult> {
			return unwrap(
				await doFetch('/api/v1/report/generate', { ...JSON_POST, body: JSON.stringify(input) })
			);
		}
	};
}

/** Browser-side clients (same-origin cookies). */
export const browserBoard = () => board((p, i) => fetch(p, { credentials: 'same-origin', ...i }));
export const browserComments = () =>
	comments((p, i) => fetch(p, { credentials: 'same-origin', ...i }));
export const browserReport = () => report((p, i) => fetch(p, { credentials: 'same-origin', ...i }));
