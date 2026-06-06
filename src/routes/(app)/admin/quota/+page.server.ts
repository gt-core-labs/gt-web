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

// Onboarding (start/complete) is driven client-side against /api/v1/quota/onboard/* — those routes
// live on the gt-orch-server daemon (a HOST process behind Traefik), which the SSR backend client
// cannot reach (GT_BACKEND_URL points at gt-mcp-server). Rotate/retire stay SSR actions: they hit
// the in-container quota REST surface. The Probe button was removed (hq-quota-onboard-web.3) — probe
// needs real provider headers (remaining/resets_at_secs) fed via the quota-feed channel, not a body.
export const actions: Actions = {
	rotate: async (event) => act(event, 'rotate'),
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

async function act(event: Parameters<Actions['rotate']>[0], _kind: 'rotate') {
	if (!hasScope(event.locals.user?.scopes, 'quota.write')) return fail(403, { error: 'Requires quota.write' });
	const account = String((await event.request.formData()).get('account') ?? '').trim();
	if (!account) return fail(400, { error: 'Missing account id.' });
	try {
		await serverAdmin(event).rotateQuota(account);
		return { ok: true };
	} catch (err) {
		return failFrom(err);
	}
}
