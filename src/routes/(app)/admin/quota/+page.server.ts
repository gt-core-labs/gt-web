import { error, fail } from '@sveltejs/kit';
import { hasScope } from '$lib/api/auth';
import { TrackerError } from '$lib/api/tracker';
import { serverAdmin } from '$lib/server/api';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	if (!hasScope(event.locals.user?.scopes, 'quota.read')) throw error(403, 'Requires quota.read');
	const accounts = await serverAdmin(event).quotas();
	return { accounts };
};

function failFrom(err: unknown) {
	if (err instanceof TrackerError) return fail(err.status, { error: `${err.status}: ${err.message}` });
	return fail(500, { error: String(err) });
}

export const actions: Actions = {
	rotate: async (event) => act(event, 'rotate'),
	probe: async (event) => act(event, 'probe'),
	// Onboard a claude account (hq-quota-accounts.5): account id + its CLAUDE_CONFIG_DIR.
	register: async (event) => {
		if (!hasScope(event.locals.user?.scopes, 'quota.write'))
			return fail(403, { error: 'Requires quota.write' });
		const form = await event.request.formData();
		const account = String(form.get('account') ?? '').trim();
		const configDir = String(form.get('config_dir') ?? '').trim();
		if (!account || !configDir) return fail(400, { error: 'Account id and config dir are required.' });
		try {
			await serverAdmin(event).registerQuota(account, configDir);
			return { ok: true };
		} catch (err) {
			return failFrom(err);
		}
	},
	retire: async (event) => {
		if (!hasScope(event.locals.user?.scopes, 'quota.write'))
			return fail(403, { error: 'Requires quota.write' });
		const account = String((await event.request.formData()).get('account') ?? '').trim();
		if (!account) return fail(400, { error: 'Missing account id.' });
		try {
			await serverAdmin(event).retireQuota(account);
			return { ok: true };
		} catch (err) {
			return failFrom(err);
		}
	}
};

async function act(event: Parameters<Actions['rotate']>[0], kind: 'rotate' | 'probe') {
	if (!hasScope(event.locals.user?.scopes, 'quota.write')) return fail(403, { error: 'Requires quota.write' });
	const account = String((await event.request.formData()).get('account') ?? '').trim();
	if (!account) return fail(400, { error: 'Missing account id.' });
	try {
		if (kind === 'rotate') await serverAdmin(event).rotateQuota(account);
		else await serverAdmin(event).probeQuota(account);
		return { ok: true };
	} catch (err) {
		return failFrom(err);
	}
}
