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

/** Scheduled report digest config (hq-84f93b). */
export interface ReportSchedule {
	enabled: boolean;
	hour: number;
	minute: number;
	tz_offset_minutes: number;
	rig: string;
	workspace: string;
	last_sent_date: string | null;
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

	async function getReportSchedule(): Promise<ReportSchedule> {
		const res = await fetch('/api/v1/system/report/schedule');
		if (!res.ok) throw new TrackerError(res.status, await res.text());
		return res.json();
	}

	async function updateReportSchedule(patch: Partial<ReportSchedule>): Promise<ReportSchedule> {
		const res = await fetch('/api/v1/system/report/schedule', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(patch)
		});
		if (!res.ok) throw new TrackerError(res.status, await res.text());
		return res.json();
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

	async function runReportNow(): Promise<ReportRunResult> {
		const res = await fetch('/api/v1/system/report/run', { method: 'POST' });
		if (!res.ok) throw new TrackerError(res.status, await res.text());
		return res.json();
	}

	return {
		getConfig,
		updateConfig,
		runArchiveNow,
		getReportSchedule,
		updateReportSchedule,
		listReportSubscribers,
		addReportSubscriber,
		removeReportSubscriber,
		toggleReportSubscriber,
		runReportNow
	};
}

export function serverSystem(fetch: Fetcher) {
	return systemClient(fetch);
}

export function browserSystem() {
	return systemClient(window.fetch.bind(window));
}
