<script lang="ts">
	import { enhance } from '$app/forms';
	import { hasScope } from '$lib/api/auth';
	import { Badge, Button, Card } from '$lib/ui';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const canWrite = $derived(hasScope(data.user?.scopes, 'users.write'));
	let saving = $state(false);

	// `form` is a union over the action's return branches; the echoed field lives
	// only on the failure branches, so read it through a loose view.
	const fv = $derived((form ?? {}) as Record<string, string | undefined>);

	const fmtDate = (secs: number) => new Date(secs * 1000).toLocaleDateString();
</script>

<div class="space-y-6">
	<header class="flex items-center justify-between">
		<h1 class="h2">Users <span class="text-base opacity-60">({data.users.length})</span></h1>
	</header>

	{#if canWrite}
		<Card>
			<h2 class="h4 mb-3">Create user</h2>
			<form
				method="POST"
				action="?/create"
				use:enhance={() => {
					saving = true;
					return async ({ update }) => {
						await update();
						saving = false;
					};
				}}
				class="grid gap-3 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end"
			>
				<label class="label">
					<span class="label-text">Email</span>
					<input class="input" type="email" name="email" required value={fv.email ?? ''} />
				</label>
				<label class="label">
					<span class="label-text">Password</span>
					<input class="input" type="password" name="password" required />
				</label>
				<label class="label">
					<span class="label-text">Scopes <span class="opacity-60">(space/comma)</span></span>
					<input class="input" type="text" name="scopes" placeholder="issues.read documents.read" />
				</label>
				<Button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create'}</Button>
			</form>
			{#if form?.error}<p class="mt-2 text-sm text-error-500">{form.error}</p>{/if}
			{#if form?.ok}<p class="mt-2 text-sm text-success-500">User created.</p>{/if}
		</Card>
	{/if}

	<div class="table-wrap">
		<table class="table">
			<thead>
				<tr>
					<th>Email</th>
					<th>Subject</th>
					<th>Scopes</th>
					<th>Created</th>
				</tr>
			</thead>
			<tbody>
				{#each data.users as u (u.sub)}
					<tr>
						<td class="font-medium">{u.email}</td>
						<td class="opacity-70">{u.sub}</td>
						<td>
							<span class="flex flex-wrap gap-1">
								{#each u.scopes as s (s)}<Badge variant="surface">{s}</Badge>{/each}
							</span>
						</td>
						<td class="opacity-70">{fmtDate(u.created_at)}</td>
					</tr>
				{/each}
				{#if data.users.length === 0}
					<tr><td colspan="4" class="py-6 text-center opacity-60">No users.</td></tr>
				{/if}
			</tbody>
		</table>
	</div>
</div>
