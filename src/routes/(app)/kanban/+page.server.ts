import { listUsers } from '$lib/api/auth';
import { serverBoard, serverMeta } from '$lib/server/api';
import { backendFetch } from '$lib/server/backend';
import { attachParent, resolveParentMap } from '$lib/server/relations';
import type { PageServerLoad } from './$types';

/**
 * Kanban board load (hq-95c2bb): the board snapshot for the active rig's
 * (rig, workspace) scope key.
 *
 * - `rig` is the active rig's bead PREFIX (issues.rig == prefix), same
 *   resolution as the tracker page.
 * - `workspace` here is the BOARD project key (the hq.issues `workspace`
 *   column, hq-62130a). It follows the session workspace (the header
 *   `cotrafa · admin` switcher, `locals.user.workspace`) so a client tenant
 *   sees its own board — `default` is just the fallback for an anonymous/legacy
 *   session, not a hardcode (gtweb-370344). `?archived=1` overrides to the
 *   `archive` scope.
 */
export const load: PageServerLoad = async (event) => {
	const { activeRig, rigs } = await event.parent();
	const rig = rigs.find((r: { name: string }) => r.name === activeRig)?.prefix ?? 'hq';
	const url = event.url;
	// Manual archiving (hq-039316): archived cards live in the `archive` board
	// workspace; `?archived=1` flips the whole view to that scope.
	const archived = url.searchParams.get('archived') === '1';
	const workspace = archived ? 'archive' : (event.locals.user?.workspace ?? 'default');
	const group_by = url.searchParams.get('group_by') as 'assignee' | 'epic' | 'priority' | null;
	const epic = url.searchParams.get('epic');

	const cookie = event.request.headers.get('cookie') ?? '';
	const [snapshot, users, domainOptions] = await Promise.all([
		// NB: the `epic` filter is applied client-side off the resolved parent_id
		// (the board endpoint's legacy external_ref filter is dead post-refactor),
		// so we fetch the full snapshot and never forward `epic` to the backend.
		serverBoard(event).snapshot({
			rig,
			workspace,
			...(group_by ? { group_by } : {})
		}),
		// Registered user emails for the assignee dropdown (hq-039316);
		// sessions without `users.read` degrade to [] (free-text input).
		listUsers((input, init) => backendFetch(String(input), cookie, init))
			.then((u) => u.map((x) => x.email))
			.catch(() => [] as string[]),
		// Closed Domain set for the New-bead modal selector (gtweb-186fbf). Sourced
		// from gt-meta so a typo can't be submitted; sessions without `meta.read`
		// degrade to [] and the modal falls back to a free-text CSV input.
		serverMeta(event)
			.domains()
			.catch(() => [] as string[])
	]);
	// child_of refactor (@3d6ea41): the board cards no longer carry the epic
	// pointer, so resolve the parent map (one query per epic) and stitch
	// parent_id onto every card — the page groups the epic lanes off this field.
	const fetcher = (path: string, init?: RequestInit) => backendFetch(path, cookie, init);
	const epicIds = snapshot.columns
		.flatMap((c) => c.cards)
		.filter((card) => card.issue_type === 'epic')
		.map((card) => card.id);
	const parents = await resolveParentMap(fetcher, { rig, workspace }, epicIds);
	for (const column of snapshot.columns) {
		column.cards = attachParent(column.cards, parents);
		if (column.lanes) {
			for (const lane of column.lanes) lane.cards = attachParent(lane.cards, parents);
		}
	}

	return {
		snapshot,
		rig,
		boardWorkspace: workspace,
		groupBy: group_by ?? '',
		epic: epic ?? '',
		users,
		domainOptions,
		archived
	};
};
