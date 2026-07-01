import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import type { PageServerLoad } from './$types';

/**
 * The rig CRUD moved into the GitHub complemento (epic hq-vcs-connections.6) so it
 * sits next to the connection that clones it. This route is kept only as a permanent
 * redirect so existing bookmarks / links don't 404 — the complemento is the primary
 * surface, and the standalone "Rigs" nav item is gone.
 */
export const load: PageServerLoad = async () => {
	redirect(308, `${base}/complementos/github`);
};
