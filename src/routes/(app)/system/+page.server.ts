import { error } from '@sveltejs/kit';
import { hasScope } from '$lib/api/auth';
import { TrackerError } from '$lib/api/tracker';
import { serverSystemApi } from '$lib/server/api';
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

	// Report digest (hq-b97264): schedule + subscribers, best-effort like config.
	let reportSchedule = null;
	let reportSubscribers = null;
	let reportError: string | null = null;
	try {
		const api = serverSystemApi(event);
		reportSchedule = await api.getReportSchedule();
		reportSubscribers = await api.listReportSubscribers();
	} catch (err) {
		reportError = describe(err);
	}

	return { config, configError, reportSchedule, reportSubscribers, reportError };
};
