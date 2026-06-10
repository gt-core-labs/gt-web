import { error } from '@sveltejs/kit';
import { hasScope } from '$lib/api/auth';
import type { PageServerLoad } from './$types';

/**
 * Gate the Complementos hub on `connection.read` — the read scope for VCS
 * connections (epic hq-vcs-connections). The cards themselves come from the
 * static manifest (`$lib/complementos/manifest`), so this load only enforces
 * access; the navbar entry is gated on the same scope.
 */
export const load: PageServerLoad = async (event) => {
	if (!hasScope(event.locals.user?.scopes, 'connection.read')) {
		throw error(403, 'Requires connection.read');
	}
	return {};
};
