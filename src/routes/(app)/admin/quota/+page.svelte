<script lang="ts">
	import { enhance } from '$app/forms';
	import { hasScope } from '$lib/api/auth';
	import { Badge, Button } from '$lib/ui';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const canWrite = $derived(hasScope(data.user?.scopes, 'quota.write'));
	let saving = $state(false);

	const enhancer = () => {
		saving = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			saving = false;
		};
	};

	const pct = (w: { consumed: number; limit: number }) =>
		w.limit > 0 ? Math.min(100, Math.round((w.consumed / w.limit) * 100)) : 0;
	const fmtTime = (secs: number) => new Date(secs * 1000).toLocaleString();
</script>

<div class="space-y-6">
	<header class="flex items-center justify-between">
		<h1 class="h2">Quota <span class="text-base opacity-60">({data.accounts.length})</span></h1>
	</header>

	{#if form?.error}<p class="text-sm text-error-500">{form.error}</p>{/if}
	{#if form?.ok}<p class="text-sm text-success-500">Done.</p>{/if}

	{#if canWrite}
		<!-- Onboard a claude account for predictive rotation (hq-quota-accounts.5). The account is
		     logged in host-side first (CLAUDE_CONFIG_DIR=<dir> claude auth login); this registers it. -->
		<form
			method="POST"
			action="?/register"
			use:enhance={enhancer}
			class="flex flex-wrap items-end gap-2 rounded border border-surface-500/30 p-3"
		>
			<label class="flex flex-col text-sm">
				<span class="opacity-70">Account id</span>
				<input name="account" required placeholder="acctB" class="input" />
			</label>
			<label class="flex flex-col text-sm">
				<span class="opacity-70">CLAUDE_CONFIG_DIR</span>
				<input name="config_dir" required placeholder="/home/nixos/.claude-acctB" class="input min-w-72" />
			</label>
			<Button type="submit" variant="filled" class="btn-sm" disabled={saving}>Add account</Button>
			<span class="text-xs opacity-60">Log the account in host-side first: <code>CLAUDE_CONFIG_DIR=&lt;dir&gt; claude auth login</code></span>
		</form>
	{/if}

	<div class="table-wrap">
		<table class="table">
			<thead>
				<tr>
					<th>Account</th><th>Status</th><th>Window</th><th>Usage</th>
					<th>Resets</th><th class="text-right">Actions</th>
				</tr>
			</thead>
			<tbody>
				{#each data.accounts as acct (acct.id)}
					<tr>
						<td class="font-medium">{acct.id}</td>
						<td><Badge variant={acct.status === 'active' ? 'success' : 'warning'}>{acct.status}</Badge></td>
						<td>{acct.window?.kind ?? '—'}</td>
						<td>
							{#if acct.window}
								{acct.window.consumed} / {acct.window.limit}
								<span class="opacity-60">({pct(acct.window)}%)</span>
							{:else}
								<span class="opacity-60">—</span>
							{/if}
						</td>
						<td class="opacity-70">{acct.window ? fmtTime(acct.window.resets_at_secs) : '—'}</td>
						<td>
							<span class="flex justify-end gap-2">
								{#if canWrite}
									<form method="POST" action="?/probe" use:enhance={enhancer}>
										<input type="hidden" name="account" value={acct.id} />
										<Button type="submit" variant="tonal" class="btn-sm" disabled={saving}>Probe</Button>
									</form>
									<form
										method="POST"
										action="?/rotate"
										use:enhance={enhancer}
										onsubmit={(e) => {
											if (!confirm(`Rotate credentials for ${acct.id}?`)) e.preventDefault();
										}}
									>
										<input type="hidden" name="account" value={acct.id} />
										<Button type="submit" variant="outlined" class="btn-sm" disabled={saving}>Rotate</Button>
									</form>
									<form
										method="POST"
										action="?/retire"
										use:enhance={enhancer}
										onsubmit={(e) => {
											if (!confirm(`Retire ${acct.id} from the rotation pool?`)) e.preventDefault();
										}}
									>
										<input type="hidden" name="account" value={acct.id} />
										<Button type="submit" variant="outlined" class="btn-sm text-error-500" disabled={saving}>Retire</Button>
									</form>
								{/if}
							</span>
						</td>
					</tr>
				{/each}
				{#if data.accounts.length === 0}
					<tr><td colspan="6" class="py-6 text-center opacity-60">No quota accounts.</td></tr>
				{/if}
			</tbody>
		</table>
	</div>
</div>
