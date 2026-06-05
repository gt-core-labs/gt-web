import { error } from '@sveltejs/kit';
import { serverDocs } from '$lib/server/api';
import { TrackerError } from '$lib/api/tracker';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	try {
		const doc = await serverDocs(event).get(event.params.id);
		return { doc };
	} catch (err) {
		if (err instanceof TrackerError && err.status === 404) {
			throw error(404, `Document ${event.params.id} not found`);
		}
		throw err;
	}
};
