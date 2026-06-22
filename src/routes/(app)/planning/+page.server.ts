import { listUsers } from '$lib/api/auth';
import { serverTracker, serverMeta } from '$lib/server/api';
import { backendFetch } from '$lib/server/backend';
import { attachParent, resolveParentMap } from '$lib/server/relations';
import type { PageServerLoad } from './$types';

/**
 * Planning view load (hq-fc9fb1): the whole (rig, workspace) tracker set —
 * modules (epics, ADR D5) + their task rows with the planning columns
 * (estimated_hours / start_date / due_date, hq-62130a). Same scope-key
 * resolution as the Kanban page.
 *
 * Also loads the registered user emails (hq-039316) for the assignee
 * dropdown; sessions without `users.read` degrade to `[]` (free-text input).
 */
export const load: PageServerLoad = async (event) => {
	const { activeRig, rigs } = await event.parent();
	const rig = rigs.find((r: { name: string }) => r.name === activeRig)?.prefix ?? 'hq';
	// Manual archiving (hq-039316): archived cards live in the `archive` board
	// workspace; `?archived=1` flips the whole view to that scope. Otherwise the
	// board follows the session workspace (the header switcher,
	// `locals.user.workspace`) so a client tenant sees its own board — `default`
	// is just the anonymous/legacy fallback, not a hardcode (gtweb-370344).
	const archived = event.url.searchParams.get('archived') === '1';
	const workspace = archived ? 'archive' : (event.locals.user?.workspace ?? 'default');
	const cookie = event.request.headers.get('cookie') ?? '';
	const tr = serverTracker(event);
	const fetcher = (path: string, init?: RequestInit) => backendFetch(path, cookie, init);
	const [page, users, domainOptions] = await Promise.all([
		tr.list({ rig, workspace, limit: 1000 }),
		listUsers((input, init) => backendFetch(String(input), cookie, init))
			.then((u) => u.map((x) => x.email))
			.catch(() => [] as string[]),
		// Closed Domain set for the New-bead modal selector (gtweb-186fbf); sourced
		// from gt-meta, [] when the session lacks `meta.read` (free-text fallback).
		serverMeta(event)
			.domains()
			.catch(() => [] as string[])
	]);
	// child_of refactor (@3d6ea41): the list rows don't inline the epic, so
	// resolve the parent map (one query per epic) and stitch parent_id on.
	const epicIds = page.rows.filter((r) => r.issue_type === 'epic').map((r) => r.id);
	const parents = await resolveParentMap(fetcher, { rig, workspace }, epicIds);
	return {
		rows: attachParent(page.rows, parents),
		rig,
		boardWorkspace: workspace,
		users,
		domainOptions,
		archived
	};
};
