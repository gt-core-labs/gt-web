/**
 * Global Claude Code hook registry client (hq-hooks).
 *
 * A hook is a Claude Code settings.json entry (event + matcher + command) plus a TARGET selector
 * (workspaces / rigs / roles it applies to; an empty dimension = "all"). The registry is GLOBAL,
 * not per-workspace, so there is one list for the whole deployment; the backend materialises the
 * hooks matching a launching session's (workspace, rig, role) into its .claude/settings.json.
 *
 * Routes (no trailing slash): GET/POST /api/v1/hooks, DELETE /api/v1/hooks/:id. Reads need
 * `hooks.read`, writes `hooks.write` (admin `*`).
 */
import { TrackerError, type Fetcher } from './tracker';

/** The Claude Code hook event types the backend accepts (gt_claude_hooks::EVENT_TYPES). */
export const EVENT_TYPES = [
	'PreToolUse',
	'PostToolUse',
	'SessionStart',
	'Stop',
	'PreCompact',
	'UserPromptSubmit'
] as const;

export type HookEventType = (typeof EVENT_TYPES)[number];

/** Which sessions a hook applies to. An empty array on a dimension means "any". */
export interface HookTarget {
	workspaces: string[];
	rigs: string[];
	roles: string[];
}

export interface Hook {
	id: string;
	event: string;
	matcher: string;
	command: string;
	target: HookTarget;
	registered_at_secs: number;
}

/** POST body to register a hook. `id` is optional — omit it and the server auto-generates one;
 * supply an existing id only to upsert/replace that hook. */
export interface RegisterHookBody {
	id?: string;
	event: string;
	matcher?: string;
	command: string;
	target?: HookTarget;
}

const JSON_POST = { method: 'POST', headers: { 'content-type': 'application/json' } } as const;

async function unwrap<T>(res: Response): Promise<T> {
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new TrackerError(res.status, text || res.statusText);
	}
	return (await res.json()) as T;
}

export function hooks(doFetch: Fetcher) {
	return {
		async list(): Promise<Hook[]> {
			const j = await unwrap<{ hooks: Hook[] }>(await doFetch('/api/v1/hooks'));
			return j.hooks ?? [];
		},
		async register(body: RegisterHookBody): Promise<void> {
			await unwrap(await doFetch('/api/v1/hooks', { ...JSON_POST, body: JSON.stringify(body) }));
		},
		async retire(id: string): Promise<void> {
			const res = await doFetch(`/api/v1/hooks/${encodeURIComponent(id)}`, { method: 'DELETE' });
			if (!res.ok) {
				const text = await res.text().catch(() => '');
				throw new TrackerError(res.status, text || res.statusText);
			}
		}
	};
}

export function browserHooks() {
	return hooks((path, init) => fetch(path, { credentials: 'same-origin', ...init }));
}
