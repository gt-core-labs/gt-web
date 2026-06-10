import { error } from '@sveltejs/kit';
import { hasScope } from '$lib/api/auth';
import { serverSkills, serverMeta } from '$lib/server/api';
import { TrackerError } from '$lib/api/tracker';
import type { SkillEntry, SkillBinding } from '$lib/api/knowledge';
import type { ScopeCatalogEntry } from '$lib/api/meta';
import type { PageServerLoad } from './$types';

const msg = (e: unknown) => (e instanceof TrackerError ? `${e.status}: ${e.message}` : String(e));

/**
 * Agents — per-role composition (gtweb-agents-page). Admin-only (skills.write): it edits the role
 * template, not live sessions. Loads the skill library + per-role bindings (the same `/api/v1/skills`
 * the Knowledge library reads) and the grantable scope catalog (best-effort: `/meta/scopes` needs
 * `meta.read`, which a skills.write admin normally holds — a reject degrades the Scopes editor to a
 * free-text fallback instead of failing the page).
 */
export const load: PageServerLoad = async (event) => {
	if (!hasScope(event.locals.user?.scopes, 'skills.write')) throw error(403, 'Requires skills.write');

	const [sk, sc] = await Promise.allSettled([
		serverSkills(event).list(),
		serverMeta(event).scopes()
	]);

	return {
		skills: sk.status === 'fulfilled' ? sk.value.skills : ([] as SkillEntry[]),
		bindings: sk.status === 'fulfilled' ? sk.value.bindings : ([] as SkillBinding[]),
		skillsError: sk.status === 'rejected' ? msg(sk.reason) : null,
		scopeCatalog: sc.status === 'fulfilled' ? sc.value : (null as ScopeCatalogEntry[] | null)
	};
};
