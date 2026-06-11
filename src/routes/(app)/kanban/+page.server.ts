import { serverBoard } from '$lib/server/api';
import type { PageServerLoad } from './$types';

/**
 * Kanban board load (hq-95c2bb): the board snapshot for the active rig's
 * (rig, workspace) scope key.
 *
 * - `rig` is the active rig's bead PREFIX (issues.rig == prefix), same
 *   resolution as the tracker page.
 * - `workspace` here is the BOARD project key (the hq.issues `workspace`
 *   column, hq-62130a) — every existing card backfilled to `default`, and the
 *   tenant itself is isolated by the cookie-resolved Dolt database, so one
 *   project per tenant means the literal `default` until a project selector
 *   lands. NOT the login workspace slug.
 */
export const load: PageServerLoad = async (event) => {
	const { activeRig, rigs } = await event.parent();
	const rig = rigs.find((r: { name: string }) => r.name === activeRig)?.prefix ?? 'hq';
	const workspace = 'default';
	const url = event.url;
	const group_by = url.searchParams.get('group_by') as 'assignee' | 'epic' | 'priority' | null;
	const epic = url.searchParams.get('epic');

	const snapshot = await serverBoard(event).snapshot({
		rig,
		workspace,
		...(group_by ? { group_by } : {}),
		...(epic ? { epic } : {})
	});
	return { snapshot, rig, boardWorkspace: workspace, groupBy: group_by ?? '', epic: epic ?? '' };
};
