/**
 * System config client — archive daemon configuration.
 * Routes: GET/PUT /api/v1/system/config, POST /api/v1/system/archive/run.
 */
import { TrackerError, type Fetcher } from './tracker';

export interface ArchiveConfig {
	enabled: boolean;
	archive_after_days: number;
	interval_minutes: number;
}

export interface ArchiveRunResult {
	archived: number;
}

/** One scheduled report send (hq-c4f920, multi-schedule). */
export interface ReportSchedule {
	id: string;
	kind: string;
	mode: 'daily' | 'every_n_days' | 'once';
	n_days: number;
	date: string | null;
	hour: number;
	minute: number;
	tz_offset_minutes: number;
	rig: string;
	workspace: string;
	enabled: boolean;
	last_sent_date: string | null;
	/** Per-schedule recipients; null = the workspace's global enabled list. */
	subscribers: string[] | null;
}

/** Partial schedule write — omitted fields stay untouched. */
export type ReportSchedulePatch = Partial<
	Omit<ReportSchedule, 'id' | 'last_sent_date' | 'subscribers'>
> & { subscribers?: string[] };

/** Operator scope option (hq-00ed29): one workspace and the rigs a report
 * can target there — bead namespaces with boards ∪ the tenant's own
 * rig-catalog prefixes, folded server-side. */
export interface ReportScopeOption {
	workspace: string;
	rigs: string[];
}

/** One digest subscriber; `enabled` = the send-selection switch. */
export interface ReportSubscriber {
	id: string;
	email: string;
	enabled: boolean;
	created_at: string;
}

export interface ReportRunResult {
	queued: number;
}

function systemClient(fetch: Fetcher) {
	async function getConfig(): Promise<ArchiveConfig> {
		const res = await fetch('/api/v1/system/config');
		if (!res.ok) throw new TrackerError(res.status, await res.text());
		return res.json();
	}

	async function updateConfig(patch: Partial<ArchiveConfig>): Promise<ArchiveConfig> {
		const res = await fetch('/api/v1/system/config', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(patch)
		});
		if (!res.ok) throw new TrackerError(res.status, await res.text());
		return res.json();
	}

	async function runArchiveNow(): Promise<ArchiveRunResult> {
		const res = await fetch('/api/v1/system/archive/run', { method: 'POST' });
		if (!res.ok) throw new TrackerError(res.status, await res.text());
		return res.json();
	}

	async function listReportSchedules(): Promise<ReportSchedule[]> {
		const res = await fetch('/api/v1/system/report/schedules');
		if (!res.ok) throw new TrackerError(res.status, await res.text());
		return (await res.json()).schedules;
	}

	async function createReportSchedule(patch: ReportSchedulePatch): Promise<ReportSchedule> {
		const res = await fetch('/api/v1/system/report/schedules', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(patch)
		});
		if (!res.ok) throw new TrackerError(res.status, await res.text());
		return res.json();
	}

	async function updateReportSchedule(
		id: string,
		patch: ReportSchedulePatch
	): Promise<ReportSchedule> {
		const res = await fetch(`/api/v1/system/report/schedules/${encodeURIComponent(id)}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(patch)
		});
		if (!res.ok) throw new TrackerError(res.status, await res.text());
		return res.json();
	}

	async function deleteReportSchedule(id: string): Promise<void> {
		const res = await fetch(`/api/v1/system/report/schedules/${encodeURIComponent(id)}`, {
			method: 'DELETE'
		});
		if (!res.ok) throw new TrackerError(res.status, await res.text());
	}

	async function runReportSchedule(id: string): Promise<ReportRunResult> {
		const res = await fetch(`/api/v1/system/report/schedules/${encodeURIComponent(id)}/run`, {
			method: 'POST'
		});
		if (!res.ok) throw new TrackerError(res.status, await res.text());
		return res.json();
	}

	async function listReportKinds(): Promise<string[]> {
		const res = await fetch('/api/v1/system/report/kinds');
		if (!res.ok) throw new TrackerError(res.status, await res.text());
		return (await res.json()).kinds;
	}

	async function listReportScopes(): Promise<ReportScopeOption[]> {
		const res = await fetch('/api/v1/system/report/scopes');
		if (!res.ok) throw new TrackerError(res.status, await res.text());
		return (await res.json()).scopes ?? [];
	}

	async function listReportSubscribers(): Promise<ReportSubscriber[]> {
		const res = await fetch('/api/v1/system/report/subscribers');
		if (!res.ok) throw new TrackerError(res.status, await res.text());
		return (await res.json()).subscribers;
	}

	async function addReportSubscriber(email: string): Promise<void> {
		const res = await fetch('/api/v1/system/report/subscribers', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email })
		});
		if (!res.ok) throw new TrackerError(res.status, await res.text());
	}

	async function removeReportSubscriber(email: string): Promise<void> {
		const res = await fetch(`/api/v1/system/report/subscribers/${encodeURIComponent(email)}`, {
			method: 'DELETE'
		});
		if (!res.ok) throw new TrackerError(res.status, await res.text());
	}

	async function toggleReportSubscriber(email: string, enabled: boolean): Promise<void> {
		const res = await fetch(`/api/v1/system/report/subscribers/${encodeURIComponent(email)}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ enabled })
		});
		if (!res.ok) throw new TrackerError(res.status, await res.text());
	}

	return {
		getConfig,
		updateConfig,
		runArchiveNow,
		listReportSchedules,
		createReportSchedule,
		updateReportSchedule,
		deleteReportSchedule,
		runReportSchedule,
		listReportKinds,
		listReportScopes,
		listReportSubscribers,
		addReportSubscriber,
		removeReportSubscriber,
		toggleReportSubscriber
	};
}

export function serverSystem(fetch: Fetcher) {
	return systemClient(fetch);
}

export function browserSystem() {
	return systemClient(window.fetch.bind(window));
}
