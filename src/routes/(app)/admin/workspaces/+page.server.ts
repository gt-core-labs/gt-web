import { error, fail } from '@sveltejs/kit';
import { hasScope } from '$lib/api/auth';
import { TrackerError } from '$lib/api/tracker';
import { serverAdmin } from '$lib/server/api';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	if (!hasScope(event.locals.user?.scopes, 'workspace.read')) throw error(403, 'Requires workspace.read');
	const workspaces = await serverAdmin(event).workspaces();
	return { workspaces };
};

/** Map a thrown TrackerError to a SvelteKit `fail`, falling back to 500. */
function failFrom(err: unknown) {
	if (err instanceof TrackerError) return fail(err.status, { error: `${err.status}: ${err.message}` });
	return fail(500, { error: String(err) });
}

export const actions: Actions = {
	create: async (event) => {
		if (!hasScope(event.locals.user?.scopes, 'workspace.write')) return fail(403, { error: 'Requires workspace.write' });
		const form = await event.request.formData();
		const id = String(form.get('id') ?? '').trim();
		const name = String(form.get('name') ?? '').trim();
		if (!id || !name) return fail(400, { error: 'Id and name are required.', id, name });
		try {
			await serverAdmin(event).createWorkspace({ id, name });
			return { ok: true };
		} catch (err) {
			return failFrom(err);
		}
	},
	suspend: async (event) => transition(event, 'suspend'),
	resume: async (event) => transition(event, 'resume'),
	archive: async (event) => transition(event, 'archive')
};

type Lifecycle = 'suspend' | 'resume' | 'archive';

async function transition(event: Parameters<Actions['suspend']>[0], kind: Lifecycle) {
	if (!hasScope(event.locals.user?.scopes, 'workspace.write')) return fail(403, { error: 'Requires workspace.write' });
	const id = String((await event.request.formData()).get('id') ?? '').trim();
	if (!id) return fail(400, { error: 'Missing workspace id.' });
	const client = serverAdmin(event);
	try {
		if (kind === 'suspend') await client.suspendWorkspace(id);
		else if (kind === 'resume') await client.resumeWorkspace(id);
		else await client.archiveWorkspace(id);
		return { ok: true };
	} catch (err) {
		return failFrom(err);
	}
}
