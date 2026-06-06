<script lang="ts">
	import { enhance } from '$app/forms';
	import { hasScope } from '$lib/api/auth';
	import type { CreatedPat } from '$lib/api/security';
	import { Badge, Button, Card } from '$lib/ui';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const canWrite = $derived(hasScope(data.user?.scopes, 'tokens.write'));
	let saving = $state(false);

	// The action's return is a union; the echoed `name` lives only on the failure branches.
	const fv = $derived((form ?? {}) as Record<string, string | undefined>);
	// The freshly minted token (plaintext) — present only on the create-success branch, shown once.
	const created = $derived((form as { created?: CreatedPat } | null)?.created ?? null);

	let copied = $state(false);
	async function copy(token: string) {
		try {
			await navigator.clipboard.writeText(token);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			copied = false;
		}
	}

	const fmtDate = (secs: number) => new Date(secs * 1000).toLocaleDateString();
	const fmtUsed = (secs: number | null) => (secs ? new Date(secs * 1000).toLocaleString() : 'never');
	const fmtExpiry = (secs: number | null) => (secs ? fmtDate(secs) : 'never');
</script>

<div class="space-y-6">
	<header>
		<h1 class="h2">Security</h1>
		<p class="opacity-70">Personal access tokens and account protection.</p>
	</header>

	<Card>
		<h2 class="h4 mb-1">Personal Access Tokens</h2>
		<p class="mb-3 text-sm opacity-70">
			Long-lived bearer tokens for scripts and CI. A token authenticates as you, limited to the
			scopes you grant it (clamped to your own). Treat it like a password.
		</p>

		{#if created}
			<div class="mb-4 rounded border border-success-500/40 bg-success-500/10 p-3">
				<p class="mb-2 text-sm font-medium">
					New token <span class="opacity-70">“{created.info.name}”</span> — copy it now, it will
					not be shown again.
				</p>
				<div class="flex items-center gap-2">
					<code class="flex-1 break-all rounded bg-surface-200-800 px-2 py-1 text-sm"
						>{created.token}</code
					>
					<Button type="button" onclick={() => copy(created.token)}>
						{copied ? 'Copied' : 'Copy'}
					</Button>
				</div>
			</div>
		{/if}

		{#if canWrite}
			<form
				method="POST"
				action="?/create"
				use:enhance={() => {
					saving = true;
					return async ({ update }) => {
						// Keep the one-time token banner: don't reset the form's `created` result.
						await update({ reset: false });
						saving = false;
					};
				}}
				class="grid gap-3 sm:grid-cols-[2fr_2fr_1fr_auto] sm:items-end"
			>
				<label class="label">
					<span class="label-text">Name</span>
					<input class="input" type="text" name="name" required value={fv.name ?? ''} placeholder="ci-deploy" />
				</label>
				<label class="label">
					<span class="label-text">Scopes <span class="opacity-60">(space/comma, blank = all yours)</span></span>
					<input class="input" type="text" name="scopes" placeholder="issues.read tokens.read" />
				</label>
				<label class="label">
					<span class="label-text">Expires <span class="opacity-60">(days, blank = never)</span></span>
					<input class="input" type="number" name="expires_in_days" min="1" placeholder="90" />
				</label>
				<Button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create token'}</Button>
			</form>
			{#if form?.error}<p class="mt-2 text-sm text-error-500">{form.error}</p>{/if}
		{/if}

		<div class="table-wrap mt-4">
			<table class="table">
				<thead>
					<tr>
						<th>Name</th>
						<th>Scopes</th>
						<th>Created</th>
						<th>Expires</th>
						<th>Last used</th>
						<th>Status</th>
						{#if canWrite}<th></th>{/if}
					</tr>
				</thead>
				<tbody>
					{#each data.tokens as t (t.id)}
						<tr>
							<td class="font-medium">{t.name}</td>
							<td>
								<span class="flex flex-wrap gap-1">
									{#each t.scopes as s (s)}<Badge variant="surface">{s}</Badge>{/each}
								</span>
							</td>
							<td class="opacity-70">{fmtDate(t.created_at)}</td>
							<td class="opacity-70">{fmtExpiry(t.expires_at)}</td>
							<td class="opacity-70">{fmtUsed(t.last_used_at)}</td>
							<td>
								<Badge variant={t.status === 'active' ? 'success' : 'surface'}>{t.status}</Badge>
							</td>
							{#if canWrite}
								<td class="text-right">
									{#if t.status === 'active'}
										<form
											method="POST"
											action="?/revoke"
											use:enhance={() => async ({ update }) => update()}
										>
											<input type="hidden" name="id" value={t.id} />
											<Button type="submit" variant="tonal">Revoke</Button>
										</form>
									{/if}
								</td>
							{/if}
						</tr>
					{/each}
					{#if data.tokens.length === 0}
						<tr><td colspan={canWrite ? 7 : 6} class="py-6 text-center opacity-60">No tokens.</td></tr>
					{/if}
				</tbody>
			</table>
		</div>
	</Card>

	<Card>
		<h2 class="h4 mb-1">Two-Factor Authentication</h2>
		<p class="text-sm opacity-70">
			Add a second factor (TOTP) to your account. <span class="opacity-60">Coming soon.</span>
		</p>
	</Card>
</div>
