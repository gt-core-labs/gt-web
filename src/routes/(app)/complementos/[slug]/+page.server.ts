import { error } from '@sveltejs/kit';
import { hasScope } from '$lib/api/auth';
import type { PageServerLoad } from './$types';

/** Mirror the hub's gate (`connection.read`) so the detail route isn't reachable ungated. */
export const load: PageServerLoad = async (event) => {
	if (!hasScope(event.locals.user?.scopes, 'connection.read')) {
		throw error(403, 'Requires connection.read');
	}
	return {};
};
