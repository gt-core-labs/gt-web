import { error } from '@sveltejs/kit';
import { hasScope } from '$lib/api/auth';
import { TrackerError } from '$lib/api/tracker';
import { serverSystemApi, serverAdmin, serverBoard } from '$lib/server/api';
import type { BoardScope } from '$lib/api/board';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	if (!hasScope(event.locals.user?.scopes, 'system.read'))
		throw error(403, 'Requires system.read');

	const describe = (err: unknown): string =>
		err instanceof TrackerError
			? err.status === 404
				? 'Endpoint not available — backend may need to be redeployed.'
				: `${err.status}: ${err.message || 'request failed'}`
			: String(err);

	let config = null;
	let configError: string | null = null;
	try {
		config = await serverSystemApi(event).getConfig();
	} catch (err) {
		configError = describe(err);
	}

	// Report digests (hq-25eb60): schedules + kinds + subscribers, best-effort.
	let reportSchedules = null;
	let reportKinds: string[] = [];
	let reportSubscribers = null;
	let reportError: string | null = null;
	try {
		const api = serverSystemApi(event);
		reportSchedules = await api.listReportSchedules();
		reportKinds = await api.listReportKinds();
		reportSubscribers = await api.listReportSubscribers();
	} catch (err) {
		reportError = describe(err);
	}

	// Real board scopes — the distinct (rig, workspace) pairs with beads
	// (hq-c697bb). Selectors are conditioned on these, not on the catalog
	// cross-product (which offers boardless combinations and misses bead
	// namespaces like `hq`).
	let scopes: BoardScope[] = [];
	try {
		scopes = await serverBoard(event).scopes();
	} catch {
		// non-fatal — selectors fall back to the catalog lists below
	}

	// Catalog rigs + workspaces, the free-text/fallback path.
	let rigs: string[] = [];
	let workspaces: string[] = [];
	try {
		const adm = serverAdmin(event);
		const [rs, ws] = await Promise.all([adm.rigs(), adm.workspaces()]);
		rigs = rs.map((r) => r.name);
		// Board/issues scope keys by workspace ID (slug), not display name —
		// a schedule saved with the name filters zero rows (hq-866962).
		workspaces = ws.map((w) => w.id);
	} catch {
		// non-fatal — selectors fall back to free-text inputs
	}

	return { config, configError, reportSchedules, reportKinds, reportSubscribers, reportError, rigs, workspaces, scopes };
};
