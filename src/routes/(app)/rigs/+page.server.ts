import { error, fail } from '@sveltejs/kit';
import { hasScope } from '$lib/api/auth';
import { TrackerError } from '$lib/api/tracker';
import type { GraphCustody } from '$lib/api/graph';
import type { Connection } from '$lib/api/connection';
import { serverAdmin, serverConnection, serverGraph } from '$lib/server/api';
import type { Actions, PageServerLoad } from './$types';

/**
 * Read-only listing of the ACTIVE workspace's rigs (repos) — the workspace selected in the header
 * switcher (server-injected from the session token claim). (Re)connecting a rig to a VCS connection
 * is done inline here (gtcore-1ff551) via the `setConnection` action; registering / deleting still
 * lives in Add-ons → GitHub. Gated on `rig.read`.
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
	const canWriteRig = hasScope(event.locals.user?.scopes, 'rig.write');

	// Connections (global) — to render the reconnect picker AND flag a rig whose git_connection_ref
	// no longer exists ("lost"). Best-effort.
	let connections: Connection[] = [];
	try {
		connections = await serverConnection(event).list();
	} catch {
		connections = [];
	}

	return { rigs, rigError, graphCustody, activeWorkspace, connections, canWriteRig };
};

export const actions: Actions = {
	/**
	 * (Re)bind or clear a rig's VCS connection (gtcore-1ff551 → `rig.set-connection`). `name` and
	 * the target `git_connection_ref` ride in the form; an empty ref clears the binding. The backend
	 * rejects a no-op (422) — surfaced as a form error. Gated on `rig.write`.
	 */
	setConnection: async (event) => {
		if (!hasScope(event.locals.user?.scopes, 'rig.write')) {
			return fail(403, { error: 'Requires rig.write' });
		}
		const form = await event.request.formData();
		const name = String(form.get('name') ?? '').trim();
		const ref = String(form.get('git_connection_ref') ?? '').trim();
		if (!name) {
			return fail(400, { error: 'A rig name is required.' });
		}
		try {
			await serverAdmin(event).setRigConnection(name, ref || null);
			return { ok: true, rig: name };
		} catch (err) {
			if (err instanceof TrackerError) {
				return fail(err.status, { error: `${err.status}: ${err.message}` });
			}
			return fail(500, { error: String(err) });
		}
	}
};
