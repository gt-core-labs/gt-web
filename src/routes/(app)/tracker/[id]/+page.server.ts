import { error } from '@sveltejs/kit';
import { serverTracker } from '$lib/server/api';
import { TrackerError } from '$lib/api/tracker';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	try {
		const issue = await serverTracker(event).get(event.params.id);
		return { issue };
	} catch (err) {
		if (err instanceof TrackerError && err.status === 404) {
			throw error(404, `Bead ${event.params.id} not found`);
		}
		throw err;
	}
};
