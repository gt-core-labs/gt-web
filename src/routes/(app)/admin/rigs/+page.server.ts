import { error, fail } from '@sveltejs/kit';
import { hasScope } from '$lib/api/auth';
import { TrackerError } from '$lib/api/tracker';
import { serverAdmin } from '$lib/server/api';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	if (!hasScope(event.locals.user?.scopes, 'rig.read')) throw error(403, 'Requires rig.read');
	// Degrade instead of white-screening: a freshly switched-into tenant whose per-workspace
	// schema is not yet provisioned makes `GET /api/v1/rig` 500 ("relation rigs does not exist").
	// Surface that as an empty board + a banner rather than crashing the whole page.
	try {
		return { rigs: await serverAdmin(event).rigs() };
	} catch (err) {
		const msg = err instanceof TrackerError ? `${err.status}: ${err.message}` : String(err);
		return { rigs: [], loadError: msg };
	}
};

function failFrom(err: unknown) {
	if (err instanceof TrackerError) return fail(err.status, { error: `${err.status}: ${err.message}` });
	return fail(500, { error: String(err) });
}

/** Optional text field → undefined when blank (so it is omitted from the body). */
function opt(form: FormData, key: string): string | undefined {
	const v = String(form.get(key) ?? '').trim();
	return v || undefined;
}

export const actions: Actions = {
	add: async (event) => {
		if (!hasScope(event.locals.user?.scopes, 'rig.write')) return fail(403, { error: 'Requires rig.write' });
		const form = await event.request.formData();
		const name = String(form.get('name') ?? '').trim();
		const prefix = String(form.get('prefix') ?? '').trim();
		const git_url = String(form.get('git_url') ?? '').trim();
		const default_branch = String(form.get('default_branch') ?? '').trim() || 'main';
		if (!name || !prefix || !git_url) {
			return fail(400, { error: 'Name, prefix and git URL are required.', name, prefix, git_url });
		}
		try {
			await serverAdmin(event).addRig({
				name,
				prefix,
				git_url,
				default_branch,
				push_url: opt(form, 'push_url'),
				upstream_url: opt(form, 'upstream_url'),
				now_secs: Math.floor(Date.now() / 1000)
			});
			return { ok: true };
		} catch (err) {
			return failFrom(err);
		}
	},
	remove: async (event) => {
		if (!hasScope(event.locals.user?.scopes, 'rig.write')) return fail(403, { error: 'Requires rig.write' });
		const name = String((await event.request.formData()).get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Missing rig name.' });
		try {
			await serverAdmin(event).removeRig(name);
			return { ok: true };
		} catch (err) {
			return failFrom(err);
		}
	}
};
