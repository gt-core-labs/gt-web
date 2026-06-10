import { serverTracker } from '$lib/server/api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { activeRig } = await event.parent();
	// Beads filter by the canonical rig name (issues.rig == rigs.name, the bead-id
	// standard hq-bead-id-standard). Pass the active rig straight through — no
	// prefix resolution, so it keeps working even if a rig's prefix ≠ its name.
	const page = await serverTracker(event).list({
		limit: 500,
		...(activeRig ? { rig: activeRig } : {})
	});
	return { issues: page.rows, total: page.total };
};
