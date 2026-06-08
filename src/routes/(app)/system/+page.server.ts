import { error } from '@sveltejs/kit';
import { hasScope } from '$lib/api/auth';
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
		configError = String(err);
	}

	return { config, configError };
};
