import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * OAuth consent page (hq-oauth-as.2): the user reviews the client and scopes
 * before approving. All params come from query string (set by GET /oauth/authorize).
 * The page renders a form that POSTs directly to the backend's POST /oauth/authorize.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) throw error(401, 'Not authenticated');

	const client_id = url.searchParams.get('client_id') ?? '';
	const client_name = url.searchParams.get('client_name') ?? client_id;
	const scopes = url.searchParams.get('scopes') ?? '';
	const redirect_uri = url.searchParams.get('redirect_uri') ?? '';
	const code_challenge = url.searchParams.get('code_challenge') ?? '';
	const code_challenge_method = url.searchParams.get('code_challenge_method') ?? 'S256';
	const state = url.searchParams.get('state') ?? '';

	if (!client_id || !redirect_uri || !code_challenge) {
		throw error(400, 'Missing required OAuth parameters (client_id, redirect_uri, code_challenge)');
	}

	return {
		client_id,
		client_name,
		scopes: scopes.split(',').filter(Boolean),
		redirect_uri,
		code_challenge,
		code_challenge_method,
		state,
		user_sub: locals.user.sub,
		user_workspace: locals.user.workspace
	};
};
