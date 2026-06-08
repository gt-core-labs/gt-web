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

	return { getConfig, updateConfig, runArchiveNow };
}

export function serverSystem(fetch: Fetcher) {
	return systemClient(fetch);
}

export function browserSystem() {
	return systemClient(window.fetch.bind(window));
}
