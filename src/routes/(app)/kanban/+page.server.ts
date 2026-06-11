import { listUsers } from '$lib/api/auth';
import { serverBoard } from '$lib/server/api';
import { backendFetch } from '$lib/server/backend';
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
	const url = event.url;
	// Manual archiving (hq-039316): archived cards live in the `archive` board
	// workspace; `?archived=1` flips the whole view to that scope.
	const archived = url.searchParams.get('archived') === '1';
	const workspace = archived ? 'archive' : 'default';
	const group_by = url.searchParams.get('group_by') as 'assignee' | 'epic' | 'priority' | null;
	const epic = url.searchParams.get('epic');

	const cookie = event.request.headers.get('cookie') ?? '';
	const [snapshot, users] = await Promise.all([
		serverBoard(event).snapshot({
			rig,
			workspace,
			...(group_by ? { group_by } : {}),
			...(epic ? { epic } : {})
		}),
		// Registered user emails for the assignee dropdown (hq-039316);
		// sessions without `users.read` degrade to [] (free-text input).
		listUsers((input, init) => backendFetch(String(input), cookie, init))
			.then((u) => u.map((x) => x.email))
			.catch(() => [] as string[])
	]);
	return {
		snapshot,
		rig,
		boardWorkspace: workspace,
		groupBy: group_by ?? '',
		epic: epic ?? '',
		users,
		archived
	};
};
