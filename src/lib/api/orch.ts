/**
 * Orchestration client: agent sessions, merge board, quota accounts.
 *
 * Like the tracker client, the OpenAPI spec carries no bodies for these routes,
 * so shapes are hand-typed against the gt-agent / gt-merge / gt-quota domains.
 * Routes have NO trailing slash. Sessions REST is mounted under /api/v1/agent
 * (list/spawn/heartbeat/end/kill); convoy is an MCP-only gap.
 */
import { TrackerError, type Fetcher } from './tracker';

// gt-agent serialises state/role as flat lowercase strings (state_str / SessionRole::as_str).
export type SessionState = 'spawned' | 'working' | 'done' | 'killed';
export type SessionRole =
	| 'mayor'
	| 'polecat'
	| 'witness'
	| 'refinery'
	| 'deacon'
	| 'overseer'
	| 'sheriff'
	| 'dog';

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

export interface ConvoyMember {
	bead: string;
	state: string; // pending|active|done|failed
}

export interface Convoy {
	id: string;
	state: string; // staged|launched|closed|failed
	members: ConvoyMember[];
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
		async convoys(): Promise<Convoy[]> {
			const j = await unwrap<{ convoys: Convoy[] }>(await doFetch('/api/v1/convoy'));
			return j.convoys ?? [];
		},
		completeMember: (convoy: string, member: string) =>
			postBody(doFetch, `/api/v1/convoy/${encodeURIComponent(convoy)}/complete-member`, { member }),
		failMember: (convoy: string, member: string, reason: string) =>
			postBody(doFetch, `/api/v1/convoy/${encodeURIComponent(convoy)}/fail-member`, { member, reason }),
		heartbeatAgent: (id: string) =>
			post(doFetch, `/api/v1/agent/${encodeURIComponent(id)}/heartbeat`),
		endAgent: (id: string) => post(doFetch, `/api/v1/agent/${encodeURIComponent(id)}/end`),
		// gt-agent's KillArgs requires a reason — a bare {} body is a 422.
		killAgent: (id: string, reason: string) =>
			postBody(doFetch, `/api/v1/agent/${encodeURIComponent(id)}/kill`, { reason }),
		startMerge: (bead: string) => post(doFetch, `/api/v1/merge/${encodeURIComponent(bead)}/start`),
		completeMerge: (bead: string) => post(doFetch, `/api/v1/merge/${encodeURIComponent(bead)}/complete`),
		failMerge: (bead: string) => post(doFetch, `/api/v1/merge/${encodeURIComponent(bead)}/fail`)
	};
}

async function post(doFetch: Fetcher, path: string): Promise<void> {
	await unwrap(await doFetch(path, { ...JSON_POST, body: '{}' }));
}

async function postBody(doFetch: Fetcher, path: string, body: unknown): Promise<void> {
	await unwrap(await doFetch(path, { ...JSON_POST, body: JSON.stringify(body) }));
}

export function browserOrch() {
	return orch((path, init) => fetch(path, { credentials: 'same-origin', ...init }));
}
