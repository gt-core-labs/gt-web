import { serverTracker } from '$lib/server/api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	// One generous page covers the board; paging/filtering can come later.
	const page = await serverTracker(event).list({ limit: 500 });
	return { issues: page.rows, total: page.total };
};
