import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import type { PageServerLoad } from './$types';

/**
 * The tracker LIST retired in favor of the Kanban board (hq-562fbd): same rows,
 * rank-ordered columns + drawer. The per-bead detail (/tracker/[id]) stays —
 * analytics drill-downs and external links point there.
 */
export const load: PageServerLoad = async () => {
	throw redirect(308, `${base}/kanban`);
};
