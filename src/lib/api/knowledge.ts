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
}

export interface SkillBinding {
	role: string;
	enabled_skills: string[];
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

export function skills(doFetch: Fetcher) {
	return {
		async list(): Promise<SkillsResponse> {
			return unwrap(await doFetch('/api/v1/skills'));
		},
		async get(id: string): Promise<SkillDetail> {
			return unwrap(await doFetch(`/api/v1/skills/${encodeURIComponent(id)}`));
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
