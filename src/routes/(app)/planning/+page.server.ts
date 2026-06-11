import { serverTracker } from '$lib/server/api';
import type { PageServerLoad } from './$types';

/**
 * Planning view load (hq-fc9fb1): the whole (rig, workspace) tracker set —
 * modules (epics, ADR D5) + their task rows with the planning columns
 * (estimated_hours / start_date / due_date, hq-62130a). Same scope-key
 * resolution as the Kanban page.
 */
export const load: PageServerLoad = async (event) => {
	const { activeRig, rigs } = await event.parent();
	const rig = rigs.find((r: { name: string }) => r.name === activeRig)?.prefix ?? 'hq';
	const workspace = 'default';
	const page = await serverTracker(event).list({ rig, workspace, limit: 1000 });
	return { rows: page.rows, rig, boardWorkspace: workspace };
};
