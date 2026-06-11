import { error } from '@sveltejs/kit';
import { hasScope } from '$lib/api/auth';
import { TrackerError } from '$lib/api/tracker';
import type { GraphCustody } from '$lib/api/graph';
import { serverAdmin, serverGraph } from '$lib/server/api';
import type { PageServerLoad } from './$types';

/**
 * Read-only listing of the ACTIVE workspace's rigs (repos) — the workspace selected in the header
 * switcher (server-injected from the session token claim). Registering / deleting / refreshing lives
 * in Add-ons → GitHub. Gated on `rig.read`.
 */
export const load: PageServerLoad = async (event) => {
	if (!hasScope(event.locals.user?.scopes, 'rig.read')) {
		throw error(403, 'Requires rig.read');
	}

	let rigs: Awaited<ReturnType<ReturnType<typeof serverAdmin>['rigs']>> = [];
	let rigError: string | null = null;
	try {
		rigs = await serverAdmin(event).rigs();
	} catch (err) {
		rigError = err instanceof TrackerError ? `${err.status}: ${err.message}` : String(err);
	}

	// Per-rig graph freshness chip (built/behind/stale), keyed by rig name. Scope-gated; degrades to —.
	const canReadGraph = hasScope(event.locals.user?.scopes, 'graph.read');
	let graphCustody: GraphCustody[] = [];
	if (canReadGraph) {
		try {
			graphCustody = await serverGraph(event).list();
		} catch {
			graphCustody = [];
		}
	}
	const activeWorkspace = event.locals.user?.workspace ?? 'default';

	return { rigs, rigError, graphCustody, activeWorkspace };
};
