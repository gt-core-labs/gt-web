import { error } from '@sveltejs/kit';
import { serverDocs } from '$lib/server/api';
import { TrackerError } from '$lib/api/tracker';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	try {
		const docs = serverDocs(event);
		const doc = await docs.get(event.params.id);
		// Shares are listed globally; show only this document's.
		const shares = await docs
			.listShares()
			.then((all) => all.filter((s) => s.document_id === doc.id))
			.catch(() => []);
		return { doc, shares };
	} catch (err) {
		if (err instanceof TrackerError && err.status === 404) {
			throw error(404, `Document ${event.params.id} not found`);
		}
		throw err;
	}
};
