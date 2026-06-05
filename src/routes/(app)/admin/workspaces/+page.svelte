<script lang="ts">
	import { enhance } from '$app/forms';
	import { hasScope } from '$lib/api/auth';
	import { Badge, Button, Card } from '$lib/ui';
	import type { WorkspaceStatus } from '$lib/api/admin';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const canWrite = $derived(hasScope(data.user?.scopes, 'workspace.write'));
	let saving = $state(false);

	// Echoed fields live only on the failure branches of the action union.
	const fv = $derived((form ?? {}) as Record<string, string | undefined>);

	const BADGE: Record<WorkspaceStatus, 'success' | 'warning' | 'surface'> = {
		active: 'success',
		suspended: 'warning',
		archived: 'surface'
	};

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
		<h1 class="h2">Workspaces <span class="text-base opacity-60">({data.workspaces.length})</span></h1>
	</header>

	{#if canWrite}
		<Card>
			<h2 class="h4 mb-3">Create workspace</h2>
			<form
				method="POST"
				action="?/create"
				use:enhance={enhancer}
				class="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end"
			>
				<label class="label">
					<span class="label-text">Slug</span>
					<input class="input" type="text" name="id" required placeholder="acme" value={fv.id ?? ''} />
				</label>
				<label class="label">
					<span class="label-text">Display name</span>
					<input class="input" type="text" name="name" required value={fv.name ?? ''} />
				</label>
				<Button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create'}</Button>
			</form>
		</Card>
	{/if}

	{#if form?.error}<p class="text-sm text-error-500">{form.error}</p>{/if}

	<div class="table-wrap">
		<table class="table">
			<thead>
				<tr><th>Slug</th><th>Name</th><th>Status</th><th class="text-right">Actions</th></tr>
			</thead>
			<tbody>
				{#each data.workspaces as ws (ws.id)}
					<tr>
						<td class="font-mono">{ws.id}</td>
						<td class="font-medium">{ws.name}</td>
						<td><Badge variant={BADGE[ws.status]}>{ws.status}</Badge></td>
						<td>
							<span class="flex justify-end gap-2">
								{#if canWrite}
									{#if ws.status === 'active'}
										<form method="POST" action="?/suspend" use:enhance={enhancer}>
											<input type="hidden" name="id" value={ws.id} />
											<Button type="submit" variant="tonal" class="btn-sm" disabled={saving}>Suspend</Button>
										</form>
									{:else if ws.status === 'suspended'}
										<form method="POST" action="?/resume" use:enhance={enhancer}>
											<input type="hidden" name="id" value={ws.id} />
											<Button type="submit" variant="tonal" class="btn-sm" disabled={saving}>Resume</Button>
										</form>
									{/if}
									{#if ws.status !== 'archived'}
										<form
											method="POST"
											action="?/archive"
											use:enhance={enhancer}
											onsubmit={(e) => {
												if (!confirm(`Archive workspace ${ws.id}? This is terminal.`)) e.preventDefault();
											}}
										>
											<input type="hidden" name="id" value={ws.id} />
											<Button type="submit" variant="outlined" class="btn-sm" disabled={saving}>Archive</Button>
										</form>
									{/if}
								{/if}
							</span>
						</td>
					</tr>
				{/each}
				{#if data.workspaces.length === 0}
					<tr><td colspan="4" class="py-6 text-center opacity-60">No workspaces.</td></tr>
				{/if}
			</tbody>
		</table>
	</div>
</div>
