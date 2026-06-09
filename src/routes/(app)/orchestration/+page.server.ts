import { serverOrch, serverSkills } from '$lib/server/api';
import type { PageServerLoad } from './$types';

const value = <T>(r: PromiseSettledResult<T[]>): T[] => (r.status === 'fulfilled' ? r.value : []);
const reason = (r: PromiseSettledResult<unknown>): string | null =>
	r.status === 'rejected' ? String((r.reason as Error)?.message ?? r.reason) : null;

export const load: PageServerLoad = async (event) => {
	const o = serverOrch(event);
	// Sessions are stored with EITHER the rig prefix (e.g. "hq") OR the canonical name
	// (e.g. "gt_core") depending on how they were spawned (UI form vs orchd/MCP). A
	// server-side ?rig= filter only matches one form and silently drops the other
	// (hq-rig-isolation.8/.9). Fetch all sessions and let the client-side rigOf mapping
	// handle the prefix↔canonical resolution correctly.
	await event.parent();
	// Each tab degrades independently — a missing scope on one shouldn't blank the page.
	const [agents, merges, quotas, convoys, quotaCatalog, skills] = await Promise.allSettled([
		o.agents(undefined),
		o.merges(),
		o.quotas(),
		o.convoys(),
		o.quotaCatalog(),
		// The skills catalog defines each ROLE's config (skills + prompt); the sessions table
		// surfaces it per agent (hq-sessions-role-info.1).
		serverSkills(event).list()
	]);
	// role → { skills, hasPrompt } so a session row can show its agent's configured skills/prompt.
	const roleConfig: Record<string, { skills: string[]; hasPrompt: boolean }> = {};
	if (skills.status === 'fulfilled') {
		for (const b of skills.value.bindings) {
			roleConfig[b.role] = {
				skills: b.enabled_skills,
				hasPrompt: !!(b.prompt && b.prompt.trim())
			};
		}
	}
	return {
		agents: value(agents),
		merges: value(merges),
		quotas: value(quotas),
		convoys: value(convoys),
		quotaCatalog: value(quotaCatalog),
		roleConfig,
		errors: {
			agents: reason(agents),
			merges: reason(merges),
			quotas: reason(quotas),
			convoys: reason(convoys)
		}
	};
};
