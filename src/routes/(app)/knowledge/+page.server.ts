import { serverDocs } from '$lib/server/api';
import { TrackerError } from '$lib/api/tracker';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const q = (event.url.searchParams.get('q') ?? '').trim();
	if (!q) return { q: '', results: [], error: null };
	try {
		const results = await serverDocs(event).search({ query: q, limit: 50 });
		return { q, results, error: null };
	} catch (err) {
		const msg = err instanceof TrackerError ? `${err.status}: ${err.message}` : String(err);
		return { q, results: [], error: msg };
	}
};
