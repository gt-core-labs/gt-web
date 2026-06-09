<script lang="ts">
	import { enhance } from '$app/forms';
	import { hasScope } from '$lib/api/auth';
	import { Badge, Button, Card } from '$lib/ui';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const canWrite = $derived(hasScope(data.user?.scopes, 'rig.write'));
	let saving = $state(false);

	// Echoed fields live only on the failure branches of the action union.
	const fv = $derived((form ?? {}) as Record<string, string | undefined>);

	// Auto-derive name + prefix from the git URL unless the user has typed in those fields.
	let gitUrl = $state(fv.git_url ?? '');
	let nameValue = $state(fv.name ?? '');
	let prefixValue = $state(fv.prefix ?? '');
	let nameTouched = $state(!!fv.name);
	let prefixTouched = $state(!!fv.prefix);

	function slugFromUrl(url: string): string {
		return url.replace(/\.git$/, '').split(/[/:]/).pop() ?? '';
	}

	function onGitUrlInput(e: Event) {
		const url = (e.target as HTMLInputElement).value;
		gitUrl = url;
		const slug = slugFromUrl(url);
		if (!nameTouched) nameValue = slug.replace(/-/g, '');
		if (!prefixTouched) prefixValue = slug.split('-').map((p) => p[0] ?? '').join('');
	}

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
		<h1 class="h2">Rigs <span class="text-base opacity-60">({data.rigs.length})</span></h1>
	</header>

	{#if data.loadError}
		<aside class="card preset-tonal-warning p-3 text-sm">
			Could not load rigs for this workspace: {data.loadError}
		</aside>
	{/if}

	{#if canWrite}
		<Card>
			<h2 class="h4 mb-3">Register rig</h2>
			<form method="POST" action="?/add" use:enhance={enhancer} class="grid gap-3 sm:grid-cols-2">
				<label class="label">
					<span class="label-text">Name</span>
					<input
						class="input"
						type="text"
						name="name"
						required
						bind:value={nameValue}
						oninput={() => (nameTouched = true)}
					/>
				</label>
				<label class="label">
					<span class="label-text">Bead prefix</span>
					<input
						class="input"
						type="text"
						name="prefix"
						required
						placeholder="hq"
						bind:value={prefixValue}
						oninput={() => (prefixTouched = true)}
					/>
				</label>
				<label class="label sm:col-span-2">
					<span class="label-text">Git URL</span>
					<input
						class="input"
						type="text"
						name="git_url"
						required
						value={gitUrl}
						oninput={onGitUrlInput}
					/>
				</label>
				<label class="label">
					<span class="label-text">Default branch</span>
					<input class="input" type="text" name="default_branch" placeholder="main" />
				</label>
				<label class="label">
					<span class="label-text">Push URL <span class="opacity-60">(optional)</span></span>
					<input class="input" type="text" name="push_url" />
				</label>
				<label class="label">
					<span class="label-text">Upstream URL <span class="opacity-60">(optional)</span></span>
					<input class="input" type="text" name="upstream_url" />
				</label>
				<div class="flex items-end">
					<Button type="submit" disabled={saving}>{saving ? 'Registering…' : 'Register'}</Button>
				</div>
			</form>
		</Card>
	{/if}

	{#if form?.error}<p class="text-sm text-error-500">{form.error}</p>{/if}

	<div class="table-wrap">
		<table class="table">
			<thead>
				<tr><th>Name</th><th>Prefix</th><th>Git URL</th><th>Branch</th><th class="text-right">Actions</th></tr>
			</thead>
			<tbody>
				{#each data.rigs as rig (rig.name)}
					<tr>
						<td class="font-medium">{rig.name}</td>
						<td><Badge variant="surface">{rig.prefix}</Badge></td>
						<td class="max-w-xs truncate font-mono text-xs opacity-70" title={rig.git_url}>{rig.git_url}</td>
						<td class="font-mono">{rig.default_branch}</td>
						<td>
							<span class="flex justify-end">
								{#if canWrite}
									<form
										method="POST"
										action="?/remove"
										use:enhance={enhancer}
										onsubmit={(e) => {
											if (!confirm(`Remove rig ${rig.name}?`)) e.preventDefault();
										}}
									>
										<input type="hidden" name="name" value={rig.name} />
										<Button type="submit" variant="outlined" class="btn-sm" disabled={saving}>Remove</Button>
									</form>
								{/if}
							</span>
						</td>
					</tr>
				{/each}
				{#if data.rigs.length === 0}
					<tr><td colspan="5" class="py-6 text-center opacity-60">No rigs.</td></tr>
				{/if}
			</tbody>
		</table>
	</div>
</div>
