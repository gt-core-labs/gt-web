import { error } from '@sveltejs/kit';
import { hasScope } from '$lib/api/auth';
import { TrackerError } from '$lib/api/tracker';
import { serverSystemApi, serverAdmin, serverBoard, serverDomain } from '$lib/server/api';
import type { BoardScope } from '$lib/api/board';
import type { DomainCatalogEntry } from '$lib/api/domain';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	if (!hasScope(event.locals.user?.scopes, 'system.read'))
		throw error(403, 'Requires system.read');

	// Resolve the user's active rig prefix (same logic as /planning) so the
	// test-report form defaults to the rig currently in focus, not the first
	// alphabetical one (which is rarely what the operator wants).
	const { activeRig, rigs: layoutRigs } = await event.parent();
	const activeRigPrefix: string | null = activeRig
		? (layoutRigs.find((r: { name: string; prefix?: string }) => r.name === activeRig)?.prefix ||
			activeRig)
		: null;

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

	// Scope options for the rig/workspace selectors. Preferred source: the
	// operator endpoint (hq-00ed29) — per workspace, bead namespaces with
	// boards ∪ that tenant's own rig-catalog prefixes, folded server-side
	// (a cross-tenant catalog read is impossible from this session).
	// Fallback: the beads-only board.scopes pairs (hq-c697bb).
	let scopes: BoardScope[] = [];
	try {
		scopes = (await serverSystemApi(event).listReportScopes()).flatMap((o) =>
			o.rigs.map((rig) => ({ rig, workspace: o.workspace }))
		);
	} catch {
		// older backend — beads-only pairs
	}
	if (scopes.length === 0) {
		try {
			scopes = await serverBoard(event).scopes();
		} catch {
			// non-fatal — selectors fall back to the catalog lists below
		}
	}

	// Catalog rigs + workspaces. The rig catalog is per-workspace (tenant
	// data, X-GT-Workspace anti-spoof) so `rigs` only covers the SESSION's
	// workspace — exposed as `sessionWorkspace` so the UI can scope it
	// (hq-5aae22). Rig values are PREFIXES: the bead namespace schedules and
	// boards filter by, not the catalog display name.
	let rigs: string[] = [];
	let workspaces: string[] = [];
	try {
		const adm = serverAdmin(event);
		const [rs, ws] = await Promise.all([adm.rigs(), adm.workspaces()]);
		rigs = rs.map((r) => r.prefix || r.name);
		// Board/issues scope keys by workspace ID (slug), not display name —
		// a schedule saved with the name filters zero rows (hq-866962).
		workspaces = ws.map((w) => w.id);
	} catch {
		// non-fatal — selectors fall back to free-text inputs
	}

	// Domain catalog (gtweb-855bac, UI half of H4): the active workspace's
	// editable domain set. Best-effort + scope-gated — only `domain.read` holders
	// fetch it; everyone else gets a null list and the section shows a hint rather
	// than a 403 error. Writes are gated separately in the page by `domain.write`.
	let domains: DomainCatalogEntry[] | null = null;
	let domainError: string | null = null;
	if (hasScope(event.locals.user?.scopes, 'domain.read')) {
		try {
			domains = await serverDomain(event).list();
		} catch (err) {
			domainError = describe(err);
		}
	}

	const sessionWorkspace = event.locals.user?.workspace ?? null;
	return { config, configError, reportSchedules, reportKinds, reportSubscribers, reportError, rigs, workspaces, scopes, sessionWorkspace, activeRigPrefix, domains, domainError };
};
