import { serverTracker } from '$lib/server/api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { activeRig, rigs } = await event.parent();
	// The store filters by the rig PREFIX (e.g. "gw"), not the rig name ("gtweb").
	const activePrefix = rigs.find((r: { name: string }) => r.name === activeRig)?.prefix ?? '';
	const page = await serverTracker(event).list({
		limit: 500,
		...(activePrefix ? { rig: activePrefix } : {})
	});
	return { issues: page.rows, total: page.total };
};
