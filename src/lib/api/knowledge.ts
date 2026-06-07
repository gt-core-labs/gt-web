/**
 * Skills catalog + activity feed clients (read-only).
 *
 * Backed by /api/v1/skills and /api/v1/feed (mounted by gt-core hq-web-extras
 * .13/.14). No trailing slash; hand-typed (codegen carries no bodies).
 */
import { TrackerError, type Fetcher } from './tracker';

export interface SkillEntry {
	id: string;
	label: string;
	description: string;
	default_scopes: string[];
	registered_at_secs: number;
	/** The SKILL.md body (hq-role-skills-term.1); the terminal materialises it for the role. */
	body?: string;
}

export interface SkillBinding {
	role: string;
	enabled_skills: string[];
	/** The role's system prompt (hq-role-skills-term.4); written as the session's CLAUDE.md. */
	prompt?: string;
}

export interface SkillsResponse {
	count: number;
	skills: SkillEntry[];
	bindings: SkillBinding[];
}

export interface SkillDetail {
	skill: SkillEntry;
	enabled_for_roles: string[];
}

export interface FeedItem {
	event_id: string;
	kind: string;
	correlation_id: string;
	causation_id: string | null;
	ts: string;
}

export interface FeedPage {
	items: FeedItem[];
	offset: number;
	limit: number;
	has_more: boolean;
	next_offset: number | null;
}

export interface FeedQuery {
	channel?: string;
	offset?: number;
	limit?: number;
}

async function unwrap<T>(res: Response): Promise<T> {
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new TrackerError(res.status, text || res.statusText);
	}
	return (await res.json()) as T;
}

/** Body for registering a skill (hq-agent-observability.7). `now_secs` is server-stamped. */
export interface RegisterSkillBody {
	skill: string;
	label: string;
	description?: string;
	default_scopes?: string[];
	/** The SKILL.md body (hq-role-skills-term.1). */
	body?: string;
}

export function skills(doFetch: Fetcher) {
	return {
		async list(): Promise<SkillsResponse> {
			return unwrap(await doFetch('/api/v1/skills'));
		},
		async get(id: string): Promise<SkillDetail> {
			return unwrap(await doFetch(`/api/v1/skills/${encodeURIComponent(id)}`));
		},
		// Register a skill into the catalog (skills.write). hq-agent-observability.7.
		async register(body: RegisterSkillBody): Promise<void> {
			await unwrap(
				await doFetch('/api/v1/skills', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(body)
				})
			);
		},
		// Edit a skill's label/description/SKILL.md body (skills.write, hq-skills-edit.1). Partial.
		async update(
			id: string,
			patch: { label?: string; description?: string; body?: string }
		): Promise<void> {
			await unwrap(
				await doFetch(`/api/v1/skills/${encodeURIComponent(id)}`, {
					method: 'PUT',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(patch)
				})
			);
		},
		// Retire a skill from the catalog (skills.write).
		async retire(id: string): Promise<void> {
			await unwrap(
				await doFetch(`/api/v1/skills/${encodeURIComponent(id)}`, { method: 'DELETE' })
			);
		},
		// Enable a skill for a role (hq-role-skills-term.2) — what defines a role's skill set.
		async enableForRole(skill: string, role: string): Promise<void> {
			await unwrap(
				await doFetch(
					`/api/v1/skills/${encodeURIComponent(skill)}/roles/${encodeURIComponent(role)}`,
					{ method: 'POST' }
				)
			);
		},
		// Disable a skill for a role (hq-role-skills-term.2).
		async disableForRole(skill: string, role: string): Promise<void> {
			await unwrap(
				await doFetch(
					`/api/v1/skills/${encodeURIComponent(skill)}/roles/${encodeURIComponent(role)}`,
					{ method: 'DELETE' }
				)
			);
		},
		// Set (or clear) a role's system prompt (hq-role-skills-term.4) → the session's CLAUDE.md.
		async setRolePrompt(role: string, prompt: string): Promise<void> {
			await unwrap(
				await doFetch(`/api/v1/skills/roles/${encodeURIComponent(role)}/prompt`, {
					method: 'PUT',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ prompt })
				})
			);
		}
	};
}

export function feed(doFetch: Fetcher) {
	return {
		async page(q: FeedQuery = {}): Promise<FeedPage> {
			const qs = new URLSearchParams();
			if (q.channel) qs.set('channel', q.channel);
			if (q.offset != null) qs.set('offset', String(q.offset));
			if (q.limit != null) qs.set('limit', String(q.limit));
			const s = qs.toString();
			return unwrap(await doFetch(`/api/v1/feed${s ? `?${s}` : ''}`));
		}
	};
}

export function browserSkills() {
	return skills((path, init) => fetch(path, { credentials: 'same-origin', ...init }));
}
export function browserFeed() {
	return feed((path, init) => fetch(path, { credentials: 'same-origin', ...init }));
}
