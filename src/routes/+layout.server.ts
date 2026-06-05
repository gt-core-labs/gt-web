import type { LayoutServerLoad } from './$types';

/** Expose the resolved session to every page (login + app shell read it). */
export const load: LayoutServerLoad = ({ locals }) => ({ user: locals.user });
