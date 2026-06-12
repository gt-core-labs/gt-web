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
	/** Skills the agent has loaded (hq-orch-sessions.2); empty for manual spawns. */
	skills?: string[];
	/** Hook kinds loaded into the agent (hq-orch-sessions.2). */
	hooks?: string[];
}

/** The flat role a user picks in the spawn form (hq-orch-sessions.1). */
export type SpawnRole = 'mayor' | 'polecat' | 'witness' | 'refinery' | 'deacon' | 'overseer' | 'sheriff' | 'dog';

/** The non-dog flat roles the backend takes as a bare string; dogs need the `{dog:kind}` shape. */
const FLAT_ROLES: SpawnRole[] = ['mayor', 'polecat'];

/**
 * Map a picked flat role to the backend `SessionRole` wire shape (hq-orch-sessions.1): `mayor`/
 * `polecat` are bare strings, every dog kind (witness/refinery/deacon/overseer/sheriff/dog) is the
 * externally-tagged `{ dog: kind }` the gt-agent enum deserialises.
 */
export function roleToWire(role: SpawnRole): string | { dog: string } {
	return FLAT_ROLES.includes(role) ? role : { dog: role };
}

/** Body for agent.spawn (POST /api/v1/agent). `role` is the wire shape from {@link roleToWire}. */
export interface SpawnArgs {
	session: string;
	rig: string;
	role?: string | { dog: string };
	crew?: string;
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
	weekly_window?: QuotaWindow | null;
	/** Unix epoch when the provider last confirmed this account's window. null = never probed. */
	last_probe_secs?: number | null;
	/** Cost units accumulated locally since the last probe — the unverified tail. */
	sampled_since_probe?: number;
}

/** One account in the deploy-global pool (GET /api/v1/quota/catalog), flagged whether it is
 * already assigned to the active workspace. `id` is the account email. */
export interface CatalogAccount {
	id: string;
	assigned: boolean;
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
		async agents(rig?: string): Promise<Session[]> {
			const url = rig ? `/api/v1/agent?rig=${encodeURIComponent(rig)}` : '/api/v1/agent';
			const j = await unwrap<{ sessions: Session[] }>(await doFetch(url));
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
		// hq-quota-ws-accounts.1: the deploy-global pool, each flagged assigned to the active ws.
		async quotaCatalog(): Promise<CatalogAccount[]> {
			const j = await unwrap<{ accounts: CatalogAccount[] }>(
				await doFetch('/api/v1/quota/catalog')
			);
			return j.accounts ?? [];
		},
		// hq-quota-ws-accounts.2: attach an onboarded account (catalog id = email) to the active ws.
		assignAccount: (account: string) =>
			post(doFetch, `/api/v1/quota/${encodeURIComponent(account)}/assign`),
		// Detach an account from the active workspace (the per-ws retire — creds stay in the pool).
		async detachAccount(account: string): Promise<void> {
			await unwrap(await doFetch(`/api/v1/quota/${encodeURIComponent(account)}`, { method: 'DELETE' }));
		},
		async convoys(): Promise<Convoy[]> {
			const j = await unwrap<{ convoys: Convoy[] }>(await doFetch('/api/v1/convoy'));
			return j.convoys ?? [];
		},
		completeMember: (convoy: string, member: string) =>
			postBody(doFetch, `/api/v1/convoy/${encodeURIComponent(convoy)}/complete-member`, { member }),
		failMember: (convoy: string, member: string, reason: string) =>
			postBody(doFetch, `/api/v1/convoy/${encodeURIComponent(convoy)}/fail-member`, { member, reason }),
		// agent.spawn — names the new session in the body (id, not path). role/crew optional;
		// gt-agent only takes a flat string role for mayor|polecat (dog-kinds need a {dog:..} shape).
		spawnAgent: (body: SpawnArgs) => postBody(doFetch, '/api/v1/agent', body),
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
