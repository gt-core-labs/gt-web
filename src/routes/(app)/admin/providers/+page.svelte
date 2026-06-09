<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { PRESET_KINDS, type ProviderKind } from '$lib/api/auth';
	import { Badge, Button, Card } from '$lib/ui';
	import { Alert } from '$lib/components/ui';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let saving = $state(false);

	// The callback (redirect URI) the backend echoes on every token exchange is the
	// app's own `/auth/callback` on this origin. The admin must register this exact
	// URL in the IdP console (Google/GitHub/…); a mismatch fails the OAuth exchange.
	const callbackUrl = $derived(`${page.url.origin}/auth/callback`);
	let copied = $state(false);
	const copyCallback = async () => {
		await navigator.clipboard.writeText(callbackUrl);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	};

	const KINDS: ProviderKind[] = ['google', 'github', 'microsoft', 'generic'];
	const isPreset = (k: ProviderKind) => PRESET_KINDS.includes(k);

	// Create form: which kind is selected drives whether the endpoint fields show.
	let createKind = $state<ProviderKind>('google');
	const createNeedsEndpoints = $derived(!isPreset(createKind));

	// The provider currently being edited (loaded server-side via ?edit=).
	const editing = $derived(data.editing);
	const editNeedsEndpoints = $derived(editing ? !isPreset(editing.kind) : false);

	const enhancer = () => {
		saving = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			saving = false;
		};
	};
</script>

<div class="space-y-6">
	<header class="flex items-center justify-between">
		<h1 class="h2">OAuth providers <span class="text-base opacity-60">({data.providers.length})</span></h1>
	</header>

	{#if data.loadError}
		<Alert variant="warning">
			{data.loadError}
			<span class="opacity-80">— el backend desplegado no expone el endpoint de providers (revisar migración/schema en gt-core).</span>
		</Alert>
	{/if}

	<Card>
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div>
				<h2 class="h5">Redirect URI (callback)</h2>
				<p class="text-sm opacity-70">Register this exact URL in the IdP console. It must match for the OAuth exchange to succeed.</p>
				<code class="mt-1 inline-block font-mono text-sm">{callbackUrl}</code>
			</div>
			<Button type="button" variant="tonal" class="btn-sm" onclick={copyCallback}>{copied ? 'Copied' : 'Copy'}</Button>
		</div>
	</Card>

	{#if form?.error}<p class="text-sm text-error-500">{form.error}</p>{/if}
	{#if form?.ok}<p class="text-sm text-success-500">Saved.</p>{/if}

	{#if editing}
		<!-- Edit a single provider. client_secret is write-only: blank = keep stored. -->
		<Card>
			<div class="mb-3 flex items-center justify-between">
				<h2 class="h4">Edit provider <span class="font-mono opacity-70">{editing.id}</span></h2>
				<a href="/admin/providers" class="btn btn-sm preset-tonal-surface">Cancel</a>
			</div>
			<form method="POST" action="?/update" use:enhance={enhancer} class="grid gap-3 sm:grid-cols-2">
				<input type="hidden" name="id" value={editing.id} />
				<label class="label">
					<span class="label-text">Kind</span>
					<input class="input" type="text" value={editing.kind} disabled />
				</label>
				<label class="label">
					<span class="label-text">Display name</span>
					<input class="input" type="text" name="display_name" required value={editing.display_name} />
				</label>
				<label class="label">
					<span class="label-text">Client ID</span>
					<input class="input" type="text" name="client_id" required value={editing.client_id} />
				</label>
				<label class="label">
					<span class="label-text">Rotate client secret <span class="opacity-60">(leave empty to keep)</span></span>
					<input class="input" type="password" name="client_secret" autocomplete="off" placeholder="••••••••" />
				</label>
				{#if editNeedsEndpoints}
					<label class="label sm:col-span-2">
						<span class="label-text">Issuer</span>
						<input class="input" type="url" name="issuer" value={editing.issuer} />
					</label>
					<label class="label sm:col-span-2">
						<span class="label-text">Authorize endpoint</span>
						<input class="input" type="url" name="authorize_endpoint" value={editing.authorize_endpoint} />
					</label>
					<label class="label sm:col-span-2">
						<span class="label-text">Token endpoint</span>
						<input class="input" type="url" name="token_endpoint" value={editing.token_endpoint} />
					</label>
					<label class="label sm:col-span-2">
						<span class="label-text">Userinfo endpoint</span>
						<input class="input" type="url" name="userinfo_endpoint" value={editing.userinfo_endpoint} />
					</label>
					<label class="label sm:col-span-2">
						<span class="label-text">Scopes <span class="opacity-60">(comma-separated)</span></span>
						<input class="input" type="text" name="scopes" value={editing.scopes} />
					</label>
				{/if}
				<label class="label flex items-center gap-2">
					<input type="checkbox" class="checkbox" name="enabled" checked={editing.enabled} />
					<span class="label-text">Enabled</span>
				</label>
				<div class="flex items-end sm:col-span-2">
					<Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
				</div>
			</form>
		</Card>
	{:else}
		<!-- Create a new provider. Preset kinds hide the endpoint fields (baked server-side). -->
		<Card>
			<h2 class="h4 mb-3">Add provider</h2>
			<form method="POST" action="?/create" use:enhance={enhancer} class="grid gap-3 sm:grid-cols-2">
				<label class="label">
					<span class="label-text">Kind</span>
					<select class="select" name="kind" bind:value={createKind}>
						{#each KINDS as k (k)}<option value={k}>{k}</option>{/each}
					</select>
				</label>
				<label class="label">
					<span class="label-text">Id <span class="opacity-60">(slug, unique)</span></span>
					<input class="input" type="text" name="id" required placeholder="google" />
				</label>
				<label class="label">
					<span class="label-text">Display name</span>
					<input class="input" type="text" name="display_name" required placeholder="Google" />
				</label>
				<label class="label">
					<span class="label-text">Client ID</span>
					<input class="input" type="text" name="client_id" required />
				</label>
				<label class="label sm:col-span-2">
					<span class="label-text">Client secret</span>
					<input class="input" type="password" name="client_secret" autocomplete="off" required />
				</label>
				{#if createNeedsEndpoints}
					<label class="label sm:col-span-2">
						<span class="label-text">Issuer</span>
						<input class="input" type="url" name="issuer" required placeholder="https://idp.example.com" />
					</label>
					<label class="label sm:col-span-2">
						<span class="label-text">Authorize endpoint</span>
						<input class="input" type="url" name="authorize_endpoint" required />
					</label>
					<label class="label sm:col-span-2">
						<span class="label-text">Token endpoint</span>
						<input class="input" type="url" name="token_endpoint" required />
					</label>
					<label class="label sm:col-span-2">
						<span class="label-text">Userinfo endpoint</span>
						<input class="input" type="url" name="userinfo_endpoint" required />
					</label>
					<label class="label sm:col-span-2">
						<span class="label-text">Scopes <span class="opacity-60">(comma-separated)</span></span>
						<input class="input" type="text" name="scopes" required placeholder="openid,email,profile" />
					</label>
				{:else}
					<p class="text-sm opacity-60 sm:col-span-2">Endpoints for {createKind} are filled in automatically.</p>
				{/if}
				<div class="flex items-end sm:col-span-2">
					<Button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create'}</Button>
				</div>
			</form>
		</Card>
	{/if}

	<div class="table-wrap">
		<table class="table">
			<thead>
				<tr>
					<th>Display name</th>
					<th>Kind</th>
					<th>Id</th>
					<th>Client ID</th>
					<th>Enabled</th>
					<th class="text-right">Actions</th>
				</tr>
			</thead>
			<tbody>
				{#each data.providers as p (p.id)}
					<tr>
						<td class="font-medium">{p.display_name}</td>
						<td><Badge variant="surface">{p.kind}</Badge></td>
						<td class="font-mono opacity-70">{p.id}</td>
						<td class="font-mono opacity-70">{p.client_id}</td>
						<td>
							<form method="POST" action="?/toggle" use:enhance={enhancer}>
								<input type="hidden" name="id" value={p.id} />
								<input type="hidden" name="enabled" value={p.enabled ? 'false' : 'true'} />
								<Button type="submit" variant="tonal" class="btn-sm" disabled={saving}>
									{p.enabled ? 'On' : 'Off'}
								</Button>
							</form>
						</td>
						<td>
							<span class="flex justify-end gap-2">
								<a href="/admin/providers?edit={encodeURIComponent(p.id)}" class="btn btn-sm preset-tonal-primary">Edit</a>
								<form
									method="POST"
									action="?/delete"
									use:enhance={enhancer}
									onsubmit={(e) => {
										if (!confirm(`Delete provider ${p.id}? This cannot be undone.`)) e.preventDefault();
									}}
								>
									<input type="hidden" name="id" value={p.id} />
									<Button type="submit" variant="outlined" class="btn-sm" disabled={saving}>Delete</Button>
								</form>
							</span>
						</td>
					</tr>
				{/each}
				{#if data.providers.length === 0}
					<tr><td colspan="6" class="py-6 text-center opacity-60">No providers.</td></tr>
				{/if}
			</tbody>
		</table>
	</div>
</div>
