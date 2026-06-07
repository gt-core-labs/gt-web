import { serverOrch } from '$lib/server/api';
import type { PageServerLoad } from './$types';

const value = <T>(r: PromiseSettledResult<T[]>): T[] => (r.status === 'fulfilled' ? r.value : []);
const reason = (r: PromiseSettledResult<unknown>): string | null =>
	r.status === 'rejected' ? String((r.reason as Error)?.message ?? r.reason) : null;

export const load: PageServerLoad = async (event) => {
	const o = serverOrch(event);
	// Each tab degrades independently — a missing scope on one shouldn't blank the page.
	const [agents, merges, quotas, convoys, quotaCatalog] = await Promise.allSettled([
		o.agents(),
		o.merges(),
		o.quotas(),
		o.convoys(),
		o.quotaCatalog()
	]);
	return {
		agents: value(agents),
		merges: value(merges),
		quotas: value(quotas),
		convoys: value(convoys),
		quotaCatalog: value(quotaCatalog),
		errors: {
			agents: reason(agents),
			merges: reason(merges),
			quotas: reason(quotas),
			convoys: reason(convoys)
		}
	};
};
