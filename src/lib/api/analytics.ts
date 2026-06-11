/**
 * Analytics client (hq-1cd840): `GET /api/v1/analytics/summary` — the Kanban
 * dashboard KPIs (avance/errores/pendientes/retrasos) + chart series, the same
 * projection board.list and the report engine read. Hand-typed against
 * gt-issues::analytics.
 */

import type { Fetcher } from './tracker';
import { TrackerError } from './tracker';

export interface Slice {
	key: string;
	count: number;
}

export interface DayPoint {
	date: string;
	created: number;
	closed: number;
	remaining: number;
}

export interface ModuleProgress {
	module: string;
	closed: number;
	total: number;
}

export interface AnalyticsSummary {
	rig: string;
	workspace: string;
	today: string;
	avance: { closed: number; total: number; pct: number; by_module: ModuleProgress[] };
	errores: {
		defects: number;
		reopens: number;
		total: number;
		by_module: Slice[];
		by_nivel: Slice[];
	};
	pendientes: {
		open: number;
		working: number;
		total: number;
		by_assignee: Slice[];
		by_priority: Slice[];
		by_module: Slice[];
	};
	retrasos: {
		overdue: number;
		at_risk: number;
		at_risk_days: number;
		days_late: Slice[];
		overdue_ids: string[];
	};
	by_status: Slice[];
	series: DayPoint[];
}

export function analytics(doFetch: Fetcher) {
	return {
		async summary(q: {
			rig: string;
			workspace: string;
			epic?: string;
			at_risk_days?: number;
			series_days?: number;
		}): Promise<AnalyticsSummary> {
			const qs = new URLSearchParams();
			for (const [k, v] of Object.entries(q)) {
				if (v !== undefined && v !== '') qs.set(k, String(v));
			}
			const res = await doFetch(`/api/v1/analytics/summary?${qs}`);
			if (!res.ok) {
				const text = await res.text().catch(() => '');
				throw new TrackerError(res.status, text || res.statusText);
			}
			return (await res.json()) as AnalyticsSummary;
		}
	};
}
