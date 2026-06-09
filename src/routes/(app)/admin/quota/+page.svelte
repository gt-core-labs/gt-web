<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { browserAdmin } from '$lib/api/admin';
	import { hasScope } from '$lib/api/auth';
	import { TrackerError } from '$lib/api/tracker';
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

	// --- Web onboarding (hq-quota-onboard-web.3/.4) ---
	// The browser calls /api/v1/quota/onboard/* (served by the backend, which runs `claude auth
	// login` in-container): start returns the login URL the human visits, then complete hands back
	// the OOB code they paste. No manual account id / CLAUDE_CONFIG_DIR — the backend captures the
	// email from the handshake. NOTE: claude.ai authorizes whichever account the browser is signed
	// into and offers no account chooser, so adding a DIFFERENT account needs an incognito window.
	type Step = 'idle' | 'starting' | 'await' | 'completing';
	let step = $state<Step>('idle');
	let loginUrl = $state('');
	let sessionId = $state('');
	let code = $state('');
	let onboardErr = $state('');
	let copied = $state(false);
	const api = browserAdmin();

	const errText = (e: unknown) =>
		e instanceof TrackerError ? `${e.status}: ${e.message}` : String(e);

	async function startOnboard() {
		onboardErr = '';
		step = 'starting';
		try {
			const { session_id, url } = await api.onboardStart();
			sessionId = session_id;
			loginUrl = url;
			step = 'await';
		} catch (e) {
			onboardErr = errText(e);
			step = 'idle';
		}
	}

	async function completeOnboard() {
		if (!code.trim()) {
			onboardErr = 'Paste the code from the login page.';
			return;
		}
		onboardErr = '';
		step = 'completing';
		try {
			await api.onboardComplete(sessionId, code.trim());
			cancelOnboard();
			await invalidateAll();
		} catch (e) {
			onboardErr = errText(e);
			step = 'await';
		}
	}

	function cancelOnboard() {
		step = 'idle';
		loginUrl = '';
		sessionId = '';
		code = '';
		onboardErr = '';
		copied = false;
	}

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(loginUrl);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			onboardErr = 'Could not copy — select the link and copy manually.';
		}
	}

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
		<!-- Add a claude account by logging it in through the browser: start → visit URL → paste code.
		     The daemon runs `claude auth login` host-side and registers the captured email. -->
		<div class="space-y-3 rounded border border-surface-500/30 p-3">
			<div class="flex items-center justify-between">
				<span class="font-medium">Add claude account</span>
				{#if step === 'idle'}
					<Button variant="filled" class="btn-sm" onclick={startOnboard}>Add account</Button>
				{:else}
					<Button variant="outlined" class="btn-sm" onclick={cancelOnboard} disabled={step === 'completing'}>Cancel</Button>
				{/if}
			</div>

			{#if step === 'starting'}
				<p class="text-sm opacity-70">Starting login…</p>
			{/if}

			{#if step === 'await' || step === 'completing'}
				<p class="rounded bg-warning-500/10 p-2 text-xs text-warning-700 dark:text-warning-300">
					⚠️ This authorizes whichever account is currently signed in to claude.ai. To add a
					<strong>different</strong> account, open the link in an <strong>incognito / private window</strong>
					(or sign out of claude.ai first) — claude.ai offers no account chooser.
				</p>
				<ol class="list-inside list-decimal space-y-2 text-sm">
					<li>
						Open the login page and authenticate with the account to add:
						<span class="mt-1 flex flex-wrap items-center gap-2">
							<a href={loginUrl} target="_blank" rel="noopener noreferrer" class="anchor break-all">{loginUrl}</a>
							<Button variant="tonal" class="btn-sm" onclick={copyLink}>{copied ? 'Copied ✓' : 'Copy link'}</Button>
						</span>
					</li>
					<li>
						Paste the code it shows you here:
						<span class="mt-1 flex flex-wrap items-end gap-2">
							<input
								bind:value={code}
								placeholder="code from the login page"
								class="input min-w-72"
								disabled={step === 'completing'}
							/>
							<Button variant="filled" class="btn-sm" onclick={completeOnboard} disabled={step === 'completing'}>
								{step === 'completing' ? 'Finishing…' : 'Finish'}
							</Button>
						</span>
					</li>
				</ol>
			{/if}

			{#if onboardErr}<p class="text-sm text-error-500">{onboardErr}</p>{/if}
		</div>
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
						<td><Badge variant={acct.status === 'Healthy' ? 'success' : 'warning'}>{acct.status}</Badge></td>
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
