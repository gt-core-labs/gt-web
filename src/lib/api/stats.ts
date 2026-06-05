/**
 * Work-progress statistics over the tracker (hq-web-extras.12).
 * GET /api/v1/issues/stats?group_by=status|epic|rig|domain|assignee|owner.
 * Per-workspace (the backend keys by the caller's workspace claim).
 */
import { TrackerError, type Fetcher } from './tracker';

export type GroupBy = 'status' | 'epic' | 'rig' | 'domain' | 'assignee' | 'owner';

export interface LeadTime {
	count: number;
	mean_secs?: number;
	median_secs?: number;
	min_secs?: number;
	max_secs?: number;
}

export interface StatBucket {
	key: Record<string, string>;
	open: number;
	working: number;
	closed: number;
	other: number;
	total: number;
	progress_pct: number;
	lead_time: LeadTime;
}

export interface StatsResponse {
	group_by: string[];
	buckets: StatBucket[];
	totals: StatBucket;
}

async function unwrap<T>(res: Response): Promise<T> {
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new TrackerError(res.status, text || res.statusText);
	}
	return (await res.json()) as T;
}

export function stats(doFetch: Fetcher) {
	return {
		async byGroup(groupBy: GroupBy): Promise<StatsResponse> {
			return unwrap(await doFetch(`/api/v1/issues/stats?group_by=${encodeURIComponent(groupBy)}`));
		}
	};
}
