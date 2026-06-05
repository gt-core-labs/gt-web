/**
 * Orchestration client: agent sessions, merge board, quota accounts.
 *
 * Like the tracker client, the OpenAPI spec carries no bodies for these routes,
 * so shapes are hand-typed against the gt-agent / gt-merge / gt-quota domains.
 * Routes have NO trailing slash. convoy + sessions REST are NOT mounted yet
 * (404) — sessions live under /api/v1/agent; convoy is an MCP-only gap.
 */
import { TrackerError, type Fetcher } from './tracker';

export type SessionState = 'Spawned' | 'Working' | 'Done' | 'Killed';

export interface Session {
	id: string;
	rig: string;
	state: SessionState;
	role: string;
	crew: string | null;
}

export type MergeState = 'Ready' | 'Merging' | 'Merged' | 'Failed';

export interface MergeSlot {
	bead: string;
	branch: string;
	state: MergeState;
}

export interface QuotaWindow {
	kind: string;
	limit: number;
	started_at_secs: number;
	resets_at_secs: number;
	consumed: number;
}

export interface QuotaAccount {
	id: string;
	status: string;
	window: QuotaWindow | null;
}

/** Event kinds emitted on /stream for the orchestration channels. */
export const ORCH_EVENT_KINDS = [
	'agent.add',
	'agent.remove',
	'agent.transition',
	'merge.submit',
	'merge.start',
	'merge.complete',
	'merge.fail'
] as const;

const JSON_POST = { method: 'POST', headers: { 'content-type': 'application/json' } } as const;

async function unwrap<T>(res: Response): Promise<T> {
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new TrackerError(res.status, text || res.statusText);
	}
	return (await res.json()) as T;
}

export function orch(doFetch: Fetcher) {
	return {
		async agents(): Promise<Session[]> {
			const j = await unwrap<{ sessions: Session[] }>(await doFetch('/api/v1/agent'));
			return j.sessions ?? [];
		},
		async merges(): Promise<MergeSlot[]> {
			const j = await unwrap<{ slots: MergeSlot[] }>(await doFetch('/api/v1/merge'));
			return j.slots ?? [];
		},
		async quotas(): Promise<QuotaAccount[]> {
			const j = await unwrap<{ accounts: QuotaAccount[] }>(await doFetch('/api/v1/quota'));
			return j.accounts ?? [];
		},
		endAgent: (id: string) => post(doFetch, `/api/v1/agent/${encodeURIComponent(id)}/end`),
		killAgent: (id: string) => post(doFetch, `/api/v1/agent/${encodeURIComponent(id)}/kill`),
		startMerge: (bead: string) => post(doFetch, `/api/v1/merge/${encodeURIComponent(bead)}/start`),
		completeMerge: (bead: string) => post(doFetch, `/api/v1/merge/${encodeURIComponent(bead)}/complete`),
		failMerge: (bead: string) => post(doFetch, `/api/v1/merge/${encodeURIComponent(bead)}/fail`)
	};
}

async function post(doFetch: Fetcher, path: string): Promise<void> {
	await unwrap(await doFetch(path, { ...JSON_POST, body: '{}' }));
}

export function browserOrch() {
	return orch((path, init) => fetch(path, { credentials: 'same-origin', ...init }));
}
