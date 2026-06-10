import { serverTracker } from '$lib/server/api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { activeRig, rigs } = await event.parent();
	// Beads are stored under the rig's bead PREFIX (issues.rig == prefix): "gtweb"
	// for gtweb, "hq" for gt_core (the gt_core backfill to a canonical name never
	// ran, so the prefix is the only key that matches every rig). Resolve the active
	// rig's canonical name to its prefix for the ?rig= filter.
	const activePrefix = rigs.find((r: { name: string }) => r.name === activeRig)?.prefix ?? '';
	const page = await serverTracker(event).list({
		limit: 500,
		...(activePrefix ? { rig: activePrefix } : {})
	});
	return { issues: page.rows, total: page.total };
};
