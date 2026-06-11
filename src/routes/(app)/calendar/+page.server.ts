import { listUsers } from '$lib/api/auth';
import { serverTracker } from '$lib/server/api';
import { backendFetch } from '$lib/server/backend';
import type { PageServerLoad } from './$types';

/**
 * Calendar view load (hq-039316): same (rig, workspace) tracker set as the
 * Planning page — tasks land on their due_date (start_date fallback).
 */
export const load: PageServerLoad = async (event) => {
	const { activeRig, rigs } = await event.parent();
	const rig = rigs.find((r: { name: string }) => r.name === activeRig)?.prefix ?? 'hq';
	const workspace = 'default';
	const cookie = event.request.headers.get('cookie') ?? '';
	const [page, users] = await Promise.all([
		serverTracker(event).list({ rig, workspace, limit: 1000 }),
		listUsers((input, init) => backendFetch(String(input), cookie, init))
			.then((u) => u.map((x) => x.email))
			.catch(() => [] as string[])
	]);
	return { rows: page.rows, rig, boardWorkspace: workspace, users };
};
