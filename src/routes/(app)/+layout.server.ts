import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

/** Guard the authenticated app: anonymous requests bounce to /login?next=. */
export const load: LayoutServerLoad = ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(302, `/login?next=${encodeURIComponent(url.pathname + url.search)}`);
	}
	return { user: locals.user };
};
