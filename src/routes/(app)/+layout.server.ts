import { redirect } from '@sveltejs/kit';
import { hasScope, listWorkspaces } from '$lib/api/auth';
import { serverAdmin } from '$lib/server/api';
import { backendFetch } from '$lib/server/backend';
import { RIG_COOKIE } from '$lib/rig';
import type { LayoutServerLoad } from './$types';

/**
 * Guard the authenticated app (anonymous → /login?next=) and hydrate the shell's
 * global selectors:
 *  - `workspaces`: the caller's memberships, for the header workspace switcher.
 *  - `rigs`: the ACTIVE workspace's rig catalog (GET /api/v1/rig routes by the
 *    token's workspace), for the rig selector — so switching workspace re-lists
 *    its own rigs.
 *  - `activeRig`: the selected rig from the gt_rig cookie, but only when it still
 *    exists in the current workspace's catalog (a stale selection from another
 *    workspace falls back to "all rigs").
 */
export const load: LayoutServerLoad = async (event) => {
	const { locals, url, cookies } = event;
	if (!locals.user) {
		throw redirect(302, `/login?next=${encodeURIComponent(url.pathname + url.search)}`);
	}

	const cookie = event.request.headers.get('cookie') ?? '';
	const wsFetch = (input: RequestInfo | URL, init?: RequestInit) =>
		backendFetch(String(input), cookie, init);

	const [workspaces, rigs] = await Promise.all([
		listWorkspaces(wsFetch),
		hasScope(locals.user.scopes, 'rig.read')
			? serverAdmin(event)
					.rigs()
					.catch(() => [])
			: Promise.resolve([])
	]);

	const selected = cookies.get(RIG_COOKIE) ?? '';
	// With a single rig there's no meaningful "all rigs" choice — pin it as active so views
	// filter to it without the user having to pick. Otherwise honor a still-valid cookie, else
	// fall back to "all rigs".
	const activeRig =
		rigs.length === 1
			? rigs[0].name
			: rigs.some((r) => r.name === selected)
				? selected
				: '';

	return { user: locals.user, workspaces, rigs, activeRig };
};
