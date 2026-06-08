import { error } from '@sveltejs/kit';
import { hasScope } from '$lib/api/auth';
import { TrackerError } from '$lib/api/tracker';
import { serverSystemApi } from '$lib/server/api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	if (!hasScope(event.locals.user?.scopes, 'system.read'))
		throw error(403, 'Requires system.read');

	let config = null;
	let configError: string | null = null;
	try {
		config = await serverSystemApi(event).getConfig();
	} catch (err) {
		if (err instanceof TrackerError) {
			configError = err.status === 404
				? 'System config endpoint not available — backend may need to be redeployed.'
				: `${err.status}: ${err.message || 'request failed'}`;
		} else {
			configError = String(err);
		}
	}

	return { config, configError };
};
