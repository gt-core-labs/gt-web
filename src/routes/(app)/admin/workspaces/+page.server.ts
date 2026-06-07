import { error, fail } from '@sveltejs/kit';
import { hasScope } from '$lib/api/auth';
import { TrackerError } from '$lib/api/tracker';
import { serverAdmin, serverOrch } from '$lib/server/api';
import { backendFetch } from '$lib/server/backend';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	if (!hasScope(event.locals.user?.scopes, 'workspace.read')) throw error(403, 'Requires workspace.read');
	const workspaces = await serverAdmin(event).workspaces();
	// hq-quota-ws-accounts.4: the deploy-global account pool, so the create form can offer initial
	// accounts to seed the new tenant. Degrade to [] when quota isn't reachable / scoped.
	const accountPool = await serverOrch(event)
		.quotaCatalog()
		.then((a) => a.map((x) => x.id))
		.catch(() => [] as string[]);
	return { workspaces, accountPool };
};

/**
 * Seed a freshly created workspace with `accounts` WITHOUT churning the admin's own session: switch
 * to the new tenant server-side to mint a token scoped to it (the response carries the access token;
 * its Set-Cookie is deliberately NOT relayed to the browser, so the admin stays where they were),
 * then assign each account with that bearer. A system admin (`*`) may switch into any workspace
 * (hq-admin-ws-switch) and holds quota.write, so the attach is authorized. Returns the failed ids.
 */
async function seedAccounts(cookie: string, workspace: string, accounts: string[]): Promise<string[]> {
	const res = await backendFetch('/auth/switch', cookie, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ workspace })
	});
	if (!res.ok) return accounts; // cannot scope to the new ws ⇒ none seeded
	const token = ((await res.json()) as { access_token?: string }).access_token;
	if (!token) return accounts;
	const failed: string[] = [];
	for (const account of accounts) {
		// Bearer (not the admin's cookie) targets the NEW workspace; '' cookie so none is sent.
		const r = await backendFetch(`/api/v1/quota/${encodeURIComponent(account)}/assign`, '', {
			method: 'POST',
			headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
			body: '{}'
		});
		if (!r.ok) failed.push(account);
	}
	return failed;
}

/** Map a thrown TrackerError to a SvelteKit `fail`, falling back to 500. */
function failFrom(err: unknown) {
	if (err instanceof TrackerError) return fail(err.status, { error: `${err.status}: ${err.message}` });
	return fail(500, { error: String(err) });
}

export const actions: Actions = {
	create: async (event) => {
		if (!hasScope(event.locals.user?.scopes, 'workspace.write')) return fail(403, { error: 'Requires workspace.write' });
		const form = await event.request.formData();
		const id = String(form.get('id') ?? '').trim();
		const name = String(form.get('name') ?? '').trim();
		const accounts = form.getAll('accounts').map(String).filter(Boolean);
		if (!id || !name) return fail(400, { error: 'Id and name are required.', id, name });
		try {
			await serverAdmin(event).createWorkspace({ id, name });
			// Seed the chosen initial accounts into the new tenant (best-effort, never fails the create).
			if (accounts.length) {
				const cookie = event.request.headers.get('cookie') ?? '';
				const failed = await seedAccounts(cookie, id, accounts);
				if (failed.length) {
					return { ok: true, accountWarning: `Created, but could not assign: ${failed.join(', ')}` };
				}
			}
			return { ok: true };
		} catch (err) {
			return failFrom(err);
		}
	},
	suspend: async (event) => transition(event, 'suspend'),
	resume: async (event) => transition(event, 'resume'),
	archive: async (event) => transition(event, 'archive')
};

type Lifecycle = 'suspend' | 'resume' | 'archive';

async function transition(event: Parameters<Actions['suspend']>[0], kind: Lifecycle) {
	if (!hasScope(event.locals.user?.scopes, 'workspace.write')) return fail(403, { error: 'Requires workspace.write' });
	const id = String((await event.request.formData()).get('id') ?? '').trim();
	if (!id) return fail(400, { error: 'Missing workspace id.' });
	const client = serverAdmin(event);
	try {
		if (kind === 'suspend') await client.suspendWorkspace(id);
		else if (kind === 'resume') await client.resumeWorkspace(id);
		else await client.archiveWorkspace(id);
		return { ok: true };
	} catch (err) {
		return failFrom(err);
	}
}
