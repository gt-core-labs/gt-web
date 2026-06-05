import { redirect } from '@sveltejs/kit';
import { serverStats } from '$lib/server/api';
import { backendFetch } from '$lib/server/backend';
import { relaySetCookies } from '$lib/server/cookies';
import { TrackerError } from '$lib/api/tracker';
import type { GroupBy } from '$lib/api/stats';
import type { Actions, PageServerLoad } from './$types';

const GROUPS: GroupBy[] = ['epic', 'rig', 'status', 'domain', 'assignee', 'owner'];

interface Membership {
	workspace: string;
	role: string;
}

export const load: PageServerLoad = async (event) => {
	const cookie = event.request.headers.get('cookie') ?? '';
	const raw = event.url.searchParams.get('group_by') as GroupBy | null;
	const groupBy: GroupBy = raw && GROUPS.includes(raw) ? raw : 'epic';

	const [wsRes, stRes] = await Promise.allSettled([
		backendFetch('/auth/workspaces', cookie).then((r) => (r.ok ? (r.json() as Promise<Membership[]>) : [])),
		serverStats(event).byGroup(groupBy)
	]);

	return {
		groupBy,
		groups: GROUPS,
		workspaces: wsRes.status === 'fulfilled' ? wsRes.value : ([] as Membership[]),
		stats: stRes.status === 'fulfilled' ? stRes.value : null,
		error:
			stRes.status === 'rejected'
				? stRes.reason instanceof TrackerError
					? `${stRes.reason.status}: ${stRes.reason.message}`
					: String(stRes.reason)
				: null
	};
};

export const actions: Actions = {
	// Switch active workspace (hq-identity.3): the backend rotates the session
	// cookies to a token carrying the new workspace claim; relay them, then reload.
	switch: async ({ request, cookies }) => {
		const form = await request.formData();
		const workspace = String(form.get('workspace') ?? '');
		const cookie = request.headers.get('cookie') ?? '';
		const res = await backendFetch('/auth/switch', cookie, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ workspace })
		});
		if (res.ok) relaySetCookies(res.headers.getSetCookie(), cookies);
		throw redirect(303, '/stats');
	}
};
