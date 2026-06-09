import { serverTracker } from '$lib/server/api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { activeRig } = await event.parent();
	const page = await serverTracker(event).list({
		limit: 500,
		...(activeRig ? { rig: activeRig } : {})
	});
	return { issues: page.rows, total: page.total };
};
