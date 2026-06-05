import { error, fail } from '@sveltejs/kit';
import { hasScope } from '$lib/api/auth';
import { TrackerError } from '$lib/api/tracker';
import { serverMeta } from '$lib/server/api';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	if (!hasScope(event.locals.user?.scopes, 'meta.read')) throw error(403, 'Requires meta.read');
	const tools = await serverMeta(event).help();
	return { tools };
};

function failFrom(err: unknown) {
	if (err instanceof TrackerError) return fail(err.status, { error: `${err.status}: ${err.message}` });
	return fail(500, { error: String(err) });
}

/** Split a comma/whitespace-separated field into a trimmed list, dropping blanks. */
function list(raw: FormDataEntryValue | null): string[] | undefined {
	const items = String(raw ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	return items.length ? items : undefined;
}

export const actions: Actions = {
	report: async (event) => {
		if (!hasScope(event.locals.user?.scopes, 'meta.write'))
			return fail(403, { error: 'Requires meta.write' });
		const fd = await event.request.formData();
		const operation = String(fd.get('operation') ?? '').trim();
		if (!operation) return fail(400, { error: 'Operation is required.' });

		const notes = String(fd.get('notes') ?? '').trim() || undefined;
		const priorityRaw = String(fd.get('priority') ?? '').trim();
		const priority = priorityRaw ? Number(priorityRaw) : undefined;
		if (priority !== undefined && (!Number.isInteger(priority) || priority < 0))
			return fail(400, { error: 'Priority must be a non-negative integer.' });
		const external_ref = String(fd.get('external_ref') ?? '').trim() || undefined;

		try {
			const result = await serverMeta(event).reportGap({
				operation,
				notes,
				priority,
				external_ref,
				surface: list(fd.get('surface')),
				domain: list(fd.get('domain'))
			});
			return { ok: true, bead: result.bead };
		} catch (err) {
			return failFrom(err);
		}
	}
};
