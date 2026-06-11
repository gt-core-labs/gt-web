import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Retired in favor of /analytics (hq-1cd840): the four operator KPIs + charts
 * over the same board projection this page used to aggregate (hq-562fbd).
 */
export const load: PageServerLoad = async () => {
	throw redirect(308, '/analytics');
};
