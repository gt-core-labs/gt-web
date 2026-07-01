<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { hasScope } from '$lib/api/auth';
	import { Icon } from '$lib/ui';
	import { browserConnection, GITHUB_INSTALL_URL, type GithubRepo } from '$lib/api/connection';
	import { findComplemento } from '$lib/complementos/manifest';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const meta = findComplemento('github');

	const canConnWrite = $derived(hasScope(data.user?.scopes, 'connection.write'));
	const canRigWrite = $derived(data.canWriteRig);
	// github_app connections feed the repo picker; a PAT is a manual-URL fallback.
	const appConnections = $derived(data.connections.filter((c) => c.kind === 'github_app'));

	const fv = $derived((form ?? {}) as Record<string, string | undefined>);
	const formScope = $derived(fv.formScope);

	let saving = $state(false);
	// Whether the (collapsed-when-configured) GitHub App form is open for editing.
	let editingApp = $state(false);
	const enhancer = () => {
		saving = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			saving = false;
			// After a save the reloaded data carries the config → collapse the form again.
			editingApp = false;
		};
	};


	// Open the App install flow in a popup. NO `noopener` — the callback page (loaded in the popup)
	// needs `window.opener` to refresh this page once the connection is created.
	function openInstall() {
		window.open(GITHUB_INSTALL_URL, 'gh-install', 'width=920,height=820');
	}

	// When the install callback redirects back here (?gh_connected=<id>): if we are the popup, reload
	// the opener (so its connection list updates) and close; otherwise strip the param for a clean URL.
	onMount(() => {
		const u = new URL(window.location.href);
		if (!u.searchParams.get('gh_connected')) return;
		if (window.opener && !window.opener.closed) {
			window.opener.location.reload();
			window.close();
		} else {
			u.searchParams.delete('gh_connected');
			history.replaceState(null, '', u.pathname + u.search);
		}
	});

	// The webhook URL the admin pastes into the GitHub App (hq-61ea43); the callback shares the host.
	const webhookUrl = $derived(`${page.url.origin}/api/v1/connection/github/webhook`);
	const callbackUrl = $derived(`${page.url.origin}/api/v1/connection/github/callback`);
	let copied = $state('');
	const copy = async (text: string, which: string) => {
		await navigator.clipboard.writeText(text);
		copied = which;
		setTimeout(() => (copied = ''), 1500);
	};

	// ── Register-repo form state ─────────────────────────────────────────────
	let gitUrl = $state('');
	let nameValue = $state('');
	let prefixValue = $state('');
	let nameTouched = $state(false);
	let prefixTouched = $state(false);
	let connRef = $state('');
	let repos = $state<GithubRepo[]>([]);
	let reposLoading = $state(false);
	let reposError = $state<string | null>(null);
	let selectedRepo = $state('');
	let targetWs = $state(data.activeWorkspace);

	function slugFromUrl(url: string): string {
		return url.replace(/\.git$/, '').split(/[/:]/).pop() ?? '';
	}
	function fillFromUrl(url: string) {
		gitUrl = url;
		const name = slugFromUrl(url).replace(/-/g, '');
		if (!nameTouched) nameValue = name;
		if (!prefixTouched) prefixValue = name;
	}
	function onGitUrlInput(e: Event) {
		fillFromUrl((e.target as HTMLInputElement).value);
	}
	function onNameInput(e: Event) {
		nameValue = (e.target as HTMLInputElement).value;
		nameTouched = true;
		if (!prefixTouched) prefixValue = nameValue;
	}
	async function onConnChange(e: Event) {
		connRef = (e.target as HTMLSelectElement).value;
		selectedRepo = '';
		repos = [];
		reposError = null;
		if (!connRef) return;
		reposLoading = true;
		try {
			repos = await browserConnection().githubRepos(connRef);
		} catch (err) {
			reposError =
				err && typeof err === 'object' && 'status' in err
					? `Could not list repos (${(err as { status: number }).status}). Use the manual URL.`
					: 'Could not list repos. Use the manual URL.';
		} finally {
			reposLoading = false;
		}
	}
	function onRepoChange(e: Event) {
		selectedRepo = (e.target as HTMLSelectElement).value;
		const repo = repos.find((r) => r.full_name === selectedRepo);
		if (repo) fillFromUrl(repo.clone_url);
	}
	function connLabel(id: string): string {
		const c = data.connections.find((x) => x.id === id);
		if (!c) return id;
		return c.account_login ? `${id} (${c.account_login})` : id;
	}
	// A rig whose git_connection_ref points at a connection that no longer exists has "lost" its
	// connection (the JIT clone would fail) — flag it and offer a one-click reconnect.
	const connExists = (id: string | null | undefined) =>
		!!id && data.connections.some((c) => c.id === id);

	// ── Repos management table (active workspace) ────────────────────────────
	type GraphChip = { state: 'built' | 'behind' | 'stale'; commit: string | null } | null;
	function graphChip(rigName: string): GraphChip {
		const c = data.graphCustody.find((g) => g.rig === rigName);
		if (!c) return null;
		const state = !c.stale ? 'built' : c.last_indexed_commit ? 'behind' : 'stale';
		return { state, commit: c.last_indexed_commit };
	}
	const CHIP_LABEL = { built: 'Built', behind: 'Behind', stale: 'Not built' } as const;
	let refreshing = $state<string | null>(null);
	const refreshEnhancer = (rigName: string) => () => {
		refreshing = rigName;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			refreshing = null;
		};
	};
</script>

<style>
	.bezel {
		border-radius: var(--gw-radius-2xl);
		border: 1px solid var(--gw-color-border-subtle);
		background-color: var(--gw-color-surface-3);
		padding: 3px;
	}
	.bezel-core {
		border-radius: calc(var(--gw-radius-2xl) - 3px);
		background-color: var(--gw-color-surface);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
	}
	.bezel-core-overflow {
		border-radius: calc(var(--gw-radius-2xl) - 3px);
		background-color: var(--gw-color-surface);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
		overflow: hidden;
	}

	.gw-input {
		display: block;
		width: 100%;
		border-radius: var(--gw-radius-lg);
		border: 1px solid var(--gw-color-border);
		background-color: var(--gw-color-surface-3);
		color: var(--gw-color-text);
		font-size: var(--gw-text-sm);
		padding: 0.5rem 0.75rem;
		transition: border-color 160ms cubic-bezier(0.32, 0.72, 0, 1),
			box-shadow 160ms cubic-bezier(0.32, 0.72, 0, 1);
		outline: none;
	}
	.gw-input:focus {
		border-color: var(--gw-color-primary);
		box-shadow: 0 0 0 3px oklch(60% 0.22 250 / 0.1);
	}
	.gw-input::placeholder {
		color: var(--gw-color-text-muted);
		opacity: 0.55;
	}

	.cta {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		border-radius: 9999px;
		border: none;
		background: linear-gradient(135deg, oklch(60% 0.22 250), oklch(50% 0.24 270));
		color: white;
		font-size: var(--gw-text-sm);
		font-weight: 600;
		padding: 0.5625rem 1.25rem;
		cursor: pointer;
		white-space: nowrap;
		transition: opacity 200ms cubic-bezier(0.32, 0.72, 0, 1),
			transform 200ms cubic-bezier(0.32, 0.72, 0, 1),
			box-shadow 200ms cubic-bezier(0.32, 0.72, 0, 1);
		box-shadow: 0 4px 14px -2px oklch(60% 0.22 250 / 0.35);
	}
	.cta:hover:not(:disabled) {
		opacity: 0.92;
		box-shadow: 0 6px 20px -2px oklch(60% 0.22 250 / 0.45);
	}
	.cta:active:not(:disabled) {
		transform: scale(0.98);
	}
	.cta:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.cta-arrow {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 9999px;
		background-color: rgba(255, 255, 255, 0.18);
		font-size: 0.85rem;
	}

	.btn-secondary {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		border-radius: 9999px;
		border: 1px solid var(--gw-color-border);
		background-color: var(--gw-color-surface-3);
		color: var(--gw-color-text);
		font-size: var(--gw-text-sm);
		font-weight: 500;
		padding: 0.5rem 1rem;
		cursor: pointer;
		transition: border-color 150ms cubic-bezier(0.32, 0.72, 0, 1),
			background-color 150ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.btn-secondary:hover:not(:disabled) {
		border-color: var(--gw-color-text-muted);
	}

	.btn-danger {
		display: inline-flex;
		align-items: center;
		border-radius: 9999px;
		border: 1px solid var(--gw-color-border);
		background-color: var(--gw-color-surface-3);
		color: var(--gw-color-error);
		font-size: var(--gw-text-xs);
		font-weight: 500;
		padding: 0.3125rem 0.75rem;
		cursor: pointer;
		transition: border-color 150ms cubic-bezier(0.32, 0.72, 0, 1),
			transform 150ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.btn-danger:hover:not(:disabled) {
		border-color: var(--gw-color-error);
	}
	.btn-danger:active:not(:disabled) {
		transform: scale(0.97);
	}
	.btn-danger:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		border-radius: 9999px;
		background-color: var(--gw-color-surface-3);
		border: 1px solid var(--gw-color-border-subtle);
		font-family: var(--gw-font-mono);
		font-size: 11px;
		font-weight: 600;
		padding: 2px 8px;
		color: var(--gw-color-text-muted);
		letter-spacing: 0.04em;
	}
	.chip-status {
		text-transform: uppercase;
	}
	.chip-warn {
		color: var(--gw-color-error);
		border-color: var(--gw-color-error);
	}
	.dot {
		width: 6px;
		height: 6px;
		border-radius: 9999px;
		background-color: var(--gw-color-text-muted);
		opacity: 0.6;
	}
	/* Graph freshness dot colors (hq-vcs-connections.9). */
	.dot-built {
		background-color: oklch(65% 0.18 150);
		opacity: 1;
	}
	.dot-behind {
		background-color: oklch(75% 0.16 80);
		opacity: 1;
	}
	.dot-stale {
		background-color: var(--gw-color-error);
		opacity: 1;
	}

	.graph-cell {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}
	.btn-refresh {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		border-radius: 9999px;
		border: 1px solid var(--gw-color-border);
		background-color: var(--gw-color-surface-3);
		color: var(--gw-color-text-muted);
		font-size: 11px;
		font-weight: 500;
		padding: 2px 8px;
		cursor: pointer;
		transition: border-color 150ms cubic-bezier(0.32, 0.72, 0, 1),
			color 150ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.btn-refresh:hover:not(:disabled) {
		border-color: var(--gw-color-text-muted);
		color: var(--gw-color-text);
	}
	.btn-refresh:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.spin {
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.warn-banner {
		border-radius: var(--gw-radius-xl);
		border: 1px solid oklch(88% 0.1 80);
		background-color: oklch(97% 0.04 80);
		color: oklch(48% 0.18 80);
		font-size: var(--gw-text-xs);
		padding: var(--gw-space-3) var(--gw-space-4);
	}

	.data-row {
		transition: background-color 140ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.data-row:hover {
		background-color: var(--gw-color-surface-3);
	}

	.label {
		display: block;
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--gw-color-text-muted);
	}
</style>

<div class="mx-auto max-w-4xl space-y-6">
	<!-- ── Back + header ─────────────────────────────────────────────────────── -->
	<a
		href="{base}/complementos"
		class="inline-flex items-center gap-1.5 text-sm text-[var(--gw-color-text-muted)]
			no-underline transition-colors hover:text-[var(--gw-color-text)]"
	>
		<Icon icon="lucide:arrow-left" size={15} />
		Add-ons
	</a>

	<header class="flex items-start gap-4">
		<div
			class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl
				border border-[var(--gw-color-border)] bg-[var(--gw-color-surface-3)]
				text-[var(--gw-color-text)]"
		>
			<Icon icon={meta?.icon ?? 'lucide:github'} size={24} />
		</div>
		<div class="min-w-0">
			<h1 class="text-2xl font-semibold tracking-tight text-[var(--gw-color-text)]">
				{meta?.name ?? 'GitHub'}
			</h1>
			<p class="mt-1 text-sm text-[var(--gw-color-text-muted)]">
				{meta?.description ??
					'Connect a GitHub App and register private repos to index their graph.'}
			</p>
		</div>
	</header>

	{#if form?.error}
		<p class="text-[var(--gw-text-xs)] text-[var(--gw-color-error)]">{form.error}</p>
	{/if}

	<!-- ══ ZONA 0 · GITHUB APP (PLATAFORMA) ══════════════════════════════════ -->
	{#if data.canWriteConn}
		<section class="bezel" aria-label="Platform GitHub App">
			<div class="bezel-core px-[var(--gw-space-6)] py-[var(--gw-space-5)] space-y-[var(--gw-space-4)]">
				<div class="flex items-center justify-between gap-3">
					<h2 class="text-[var(--gw-text-base)] font-semibold text-[var(--gw-color-text)]">
						GitHub App (platform)
					</h2>
					{#if data.githubApp}
						<span class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
							Configured · App {data.githubApp.app_id}
							· key {data.githubApp.has_private_key ? '✓' : '✗'}
							· webhook secret {data.githubApp.has_webhook_secret ? '✓' : '✗'}
						</span>
					{:else}
						<span class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">Not configured</span>
					{/if}
				</div>

				<p class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
					Config en BD (no .env). En la GitHub App pega estas URLs; abajo App ID, slug, private key (PEM) y webhook secret.
				</p>

				<!-- URLs to register in the GitHub App -->
				<div class="space-y-[var(--gw-space-2)]">
					<div class="space-y-[var(--gw-space-1)]">
						<span class="label">Webhook URL</span>
						<div class="flex items-center gap-[var(--gw-space-2)]">
							<code class="flex-1 truncate rounded-[var(--gw-radius-md)] border border-[var(--gw-color-border-subtle)] bg-[var(--gw-color-surface-3)] px-[var(--gw-space-2)] py-[var(--gw-space-1)] text-[var(--gw-text-xs)]">{webhookUrl}</code>
							<button type="button" class="btn-secondary" onclick={() => copy(webhookUrl, 'hook')}>{copied === 'hook' ? 'Copied' : 'Copy'}</button>
						</div>
					</div>
					<div class="space-y-[var(--gw-space-1)]">
						<span class="label">Setup URL <span class="normal-case tracking-normal opacity-60">(GitHub App → Post installation → Setup URL)</span></span>
						<div class="flex items-center gap-[var(--gw-space-2)]">
							<code class="flex-1 truncate rounded-[var(--gw-radius-md)] border border-[var(--gw-color-border-subtle)] bg-[var(--gw-color-surface-3)] px-[var(--gw-space-2)] py-[var(--gw-space-1)] text-[var(--gw-text-xs)]">{callbackUrl}</code>
							<button type="button" class="btn-secondary" onclick={() => copy(callbackUrl, 'cb')}>{copied === 'cb' ? 'Copied' : 'Copy'}</button>
						</div>
						<p class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
							GitHub sends the <code>installation_id</code> here after install — set it as <strong>Post installation → Setup URL</strong>, not the OAuth Callback URL.
						</p>
					</div>
				</div>

				{#if formScope === 'ghapp' && fv.error}
					<aside class="warn-banner" role="alert">{fv.error}</aside>
				{/if}

				{#if data.githubApp && !editingApp}
					<!-- Configured: form collapsed. Next step = install the App (brings repos). -->
					<div class="flex flex-wrap items-center gap-[var(--gw-space-3)]">
						<button
							type="button"
							class="cta"
							onclick={() => (openInstall())}
						>
							<Icon icon="lucide:github" size={15} />
							<span>Connect GitHub — install + choose repos</span>
							<span class="cta-arrow" aria-hidden="true">→</span>
						</button>
						<button type="button" class="btn-secondary" onclick={() => (editingApp = true)}>
							Edit configuration
						</button>
					</div>
					<p class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
						After installing, register repos on the <strong><a href="{base}/rigs" class="underline">Rigs</a></strong> page (pick the connection → repo dropdown).
					</p>
				{:else}
					<form method="POST" action="?/saveGithubApp" use:enhance={enhancer} class="space-y-[var(--gw-space-3)]">
						<div class="grid gap-[var(--gw-space-3)] sm:grid-cols-2">
							<div class="space-y-[var(--gw-space-1)]">
								<label class="label" for="gh-app-id">App ID <span class="normal-case tracking-normal opacity-60">(numérico)</span></label>
								<input id="gh-app-id" class="gw-input" type="text" name="app_id" required
									value={data.githubApp?.app_id ?? ''} placeholder="4028779" />
							</div>
							<div class="space-y-[var(--gw-space-1)]">
								<label class="label" for="gh-app-slug">Slug <span class="normal-case tracking-normal opacity-60">(github.com/apps/&lt;slug&gt;)</span></label>
								<input id="gh-app-slug" class="gw-input" type="text" name="app_slug" required
									value={data.githubApp?.app_slug ?? ''} placeholder="gt-core-2026-06-11" />
							</div>
						</div>
						<div class="space-y-[var(--gw-space-1)]">
							<label class="label" for="gh-pem">
								Private key (PEM)
								<span class="normal-case tracking-normal opacity-60">
									({data.githubApp?.has_private_key ? 'configured — leave blank to keep' : 'required'})
								</span>
							</label>
							<textarea id="gh-pem" class="gw-input" name="private_key_pem" rows="4"
								placeholder="-----BEGIN RSA PRIVATE KEY-----"></textarea>
						</div>
						<div class="space-y-[var(--gw-space-1)]">
							<label class="label" for="gh-hook">
								Webhook secret
								<span class="normal-case tracking-normal opacity-60">
									({data.githubApp?.has_webhook_secret ? 'configured — leave blank to keep' : 'optional'})
								</span>
							</label>
							<input id="gh-hook" class="gw-input" type="password" name="webhook_secret"
								placeholder="webhook HMAC secret" autocomplete="off" />
							<p class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
								Sealed at rest (AES-GCM), never returned. Must match the webhook Secret in the GitHub App.
							</p>
						</div>
						<div class="flex items-center gap-[var(--gw-space-3)]">
							<button type="submit" class="cta" disabled={saving}>
								<span>Save GitHub App</span>
								<span class="cta-arrow" aria-hidden="true">→</span>
							</button>
							{#if data.githubApp}
								<button type="button" class="btn-secondary" onclick={() => (editingApp = false)}>Cancel</button>
							{/if}
						</div>
					</form>
				{/if}
			</div>
		</section>
	{/if}

	<!-- ══ ZONA 1 · CONEXIONES ═══════════════════════════════════════════════ -->
	<section class="bezel" aria-label="Connections">
		<div class="bezel-core px-[var(--gw-space-6)] py-[var(--gw-space-5)] space-y-[var(--gw-space-4)]">
			<div class="flex items-center justify-between gap-3">
				<h2 class="text-[var(--gw-text-base)] font-semibold text-[var(--gw-color-text)]">
					Connections
				</h2>
				{#if canConnWrite}
					<button
						type="button"
						class="btn-secondary"
						onclick={() => (openInstall())}
					>
						<Icon icon="lucide:github" size={15} />
						Connect GitHub
					</button>
				{/if}
			</div>

			{#if data.connError}
				<aside class="warn-banner" role="alert">
					Could not list connections: {data.connError}
				</aside>
			{/if}

			<!-- Connection list -->
			{#if data.connections.length > 0}
				<div class="bezel-core-overflow border border-[var(--gw-color-border-subtle)]">
					<table class="w-full text-left">
						<thead>
							<tr class="border-b border-[var(--gw-color-border-subtle)]">
								<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Id</th>
								<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Type</th>
								<th class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)] sm:table-cell">Account</th>
								<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Status</th>
								{#if canConnWrite}
									<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Actions</th>
								{/if}
							</tr>
						</thead>
						<tbody class="divide-y divide-[var(--gw-color-border-subtle)]">
							{#each data.connections as c (c.id)}
								<tr class="data-row">
									<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
										<span class="text-[var(--gw-text-sm)] font-medium text-[var(--gw-color-text)]">{c.id}</span>
									</td>
									<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
										<span class="chip">
											{c.kind === 'github_app' ? 'GitHub App' : c.has_secret ? 'PAT' : c.kind}
										</span>
									</td>
									<td class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] sm:table-cell">
										<span class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
											{c.account_login ?? '—'}
										</span>
									</td>
									<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
										<span class="chip chip-status">{c.status}</span>
									</td>
									{#if canConnWrite}
										<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-right">
											<form
												method="POST"
												action="?/disconnect"
												use:enhance={enhancer}
												onsubmit={(e) => {
													if (!confirm(`Disconnect ${c.id}?`)) e.preventDefault();
												}}
											>
												<input type="hidden" name="id" value={c.id} />
												<button type="submit" class="btn-danger" disabled={saving}>Disconnect</button>
											</form>
										</td>
									{/if}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else if !data.connError}
				<p class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">
					No connections yet. Connect a GitHub App or register a PAT below.
				</p>
			{/if}

			<!-- PAT fallback -->
			{#if canConnWrite}
				<details class="rounded-[var(--gw-radius-lg)] border border-[var(--gw-color-border-subtle)] bg-[var(--gw-color-surface-3)] px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
					<summary class="cursor-pointer text-[var(--gw-text-sm)] font-medium text-[var(--gw-color-text)]">
						Use a Personal Access Token (fallback)
					</summary>
					<form
						method="POST"
						action="?/connectPat"
						use:enhance={enhancer}
						class="mt-[var(--gw-space-3)] space-y-[var(--gw-space-3)]"
					>
						<div class="grid gap-[var(--gw-space-3)] sm:grid-cols-2">
							<div class="space-y-[var(--gw-space-1)]">
								<label class="label" for="pat-id">Connection id</label>
								<input id="pat-id" class="gw-input" type="text" name="id" required placeholder="mi-pat" />
							</div>
							<div class="space-y-[var(--gw-space-1)]">
								<label class="label" for="pat-account">
									Account / org <span class="normal-case tracking-normal opacity-60">(optional)</span>
								</label>
								<input id="pat-account" class="gw-input" type="text" name="account_login" placeholder="mi-org" />
							</div>
						</div>
						<div class="space-y-[var(--gw-space-1)]">
							<label class="label" for="pat-secret">Token</label>
							<input id="pat-secret" class="gw-input" type="password" name="secret" required placeholder="ghp_…" autocomplete="off" />
							<p class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
								Sealed at rest (AES-GCM) and never returned. The GitHub App is preferable: ephemeral tokens, no persisted secret.
							</p>
						</div>
						<button type="submit" class="cta" disabled={saving}>
							<span>Save PAT</span>
							<span class="cta-arrow" aria-hidden="true">→</span>
						</button>
					</form>
				</details>
			{/if}
		</div>
	</section>

	<!-- ══ Register a repo (rig) ═════════════════════════════════════════════ -->
	{#if canRigWrite}
		<section class="bezel" aria-label="Register repo">
			<div class="bezel-core px-[var(--gw-space-6)] py-[var(--gw-space-5)] space-y-[var(--gw-space-4)]">
				<div class="flex items-baseline gap-[var(--gw-space-2)]">
					<h2 class="text-[var(--gw-text-base)] font-semibold text-[var(--gw-color-text)]">Register a repo</h2>
				</div>
				<p class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
					Pick a connection → a repo → the target workspace. The rig is created in that workspace and
					listed under <a href="{base}/rigs" class="underline">Rigs</a>.
				</p>

				{#if formScope === 'rig' && fv.error}
					<aside class="warn-banner" role="alert">{fv.error}</aside>
				{/if}

				<form
					method="POST"
					action="?/addRig"
					use:enhance={enhancer}
					class="space-y-[var(--gw-space-4)] rounded-[var(--gw-radius-lg)] border border-[var(--gw-color-border-subtle)] bg-[var(--gw-color-surface-3)] p-[var(--gw-space-4)]"
				>
					<div class="grid gap-[var(--gw-space-3)] sm:grid-cols-2">
						<div class="space-y-[var(--gw-space-1)]">
							<label class="label" for="repo-conn">Connection</label>
							<select id="repo-conn" class="gw-input" name="git_connection_ref" bind:value={connRef} onchange={onConnChange}>
								<option value="">No connection (manual URL)</option>
								{#each appConnections as c (c.id)}
									<option value={c.id}>{connLabel(c.id)}</option>
								{/each}
							</select>
						</div>
						<div class="space-y-[var(--gw-space-1)]">
							<label class="label" for="repo-pick">Repository</label>
							<select id="repo-pick" class="gw-input" disabled={!connRef || reposLoading || repos.length === 0} bind:value={selectedRepo} onchange={onRepoChange}>
								{#if reposLoading}
									<option value="">Loading…</option>
								{:else if !connRef}
									<option value="">Pick a connection first</option>
								{:else if repos.length === 0}
									<option value="">No repos (use the manual URL)</option>
								{:else}
									<option value="">Pick a repo…</option>
									{#each repos as r (r.full_name)}
										<option value={r.full_name}>{r.full_name}{r.private ? ' · private' : ''}</option>
									{/each}
								{/if}
							</select>
						</div>
					</div>
					{#if reposError}
						<p class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">{reposError}</p>
					{/if}

					<div class="grid gap-[var(--gw-space-3)] sm:grid-cols-3">
						<div class="space-y-[var(--gw-space-1)]">
							<label class="label" for="repo-name">Name</label>
							<input id="repo-name" class="gw-input" type="text" name="name" required bind:value={nameValue} oninput={onNameInput} placeholder="myrepo" />
						</div>
						<div class="space-y-[var(--gw-space-1)]">
							<label class="label" for="repo-prefix">Bead prefix</label>
							<input id="repo-prefix" class="gw-input" type="text" name="prefix" required bind:value={prefixValue} oninput={() => (prefixTouched = true)} placeholder="myrepo" />
						</div>
						<div class="space-y-[var(--gw-space-1)]">
							<label class="label" for="repo-ws">Workspace</label>
							<select id="repo-ws" class="gw-input" name="workspace" bind:value={targetWs}>
								{#if data.workspaces.length > 0}
									{#each data.workspaces as w (w.workspace)}
										<option value={w.workspace}>{w.workspace}</option>
									{/each}
								{:else}
									<option value={data.activeWorkspace}>{data.activeWorkspace}</option>
								{/if}
							</select>
						</div>
					</div>

					<div class="space-y-[var(--gw-space-1)]">
						<label class="label" for="repo-git-url">
							Git URL <span class="normal-case tracking-normal opacity-60">(auto from the repo, or manual)</span>
						</label>
						<input id="repo-git-url" class="gw-input" type="text" name="git_url" required value={gitUrl} oninput={onGitUrlInput} placeholder="git@github.com:org/repo.git" />
					</div>

					<div class="grid gap-[var(--gw-space-3)] sm:grid-cols-3">
						<div class="space-y-[var(--gw-space-1)]">
							<label class="label" for="repo-branch">Default branch</label>
							<input id="repo-branch" class="gw-input" type="text" name="default_branch" placeholder="main" />
						</div>
						<div class="space-y-[var(--gw-space-1)]">
							<label class="label" for="repo-push">Push URL <span class="normal-case tracking-normal opacity-60">(optional)</span></label>
							<input id="repo-push" class="gw-input" type="text" name="push_url" placeholder="https://…" />
						</div>
						<div class="space-y-[var(--gw-space-1)]">
							<label class="label" for="repo-upstream">Upstream URL <span class="normal-case tracking-normal opacity-60">(optional)</span></label>
							<input id="repo-upstream" class="gw-input" type="text" name="upstream_url" placeholder="https://…" />
						</div>
					</div>

					<button type="submit" class="cta" disabled={saving}>
						<span>Register repo</span>
						<span class="cta-arrow" aria-hidden="true">→</span>
					</button>
				</form>
			</div>
		</section>
	{/if}

	<!-- ══ Manage repos (active workspace) ═══════════════════════════════════ -->
	{#if data.canWriteRig}
		<section class="bezel" aria-label="Manage repos">
			<div class="bezel-core px-[var(--gw-space-6)] py-[var(--gw-space-5)] space-y-[var(--gw-space-4)]">
				<div class="flex items-baseline gap-[var(--gw-space-2)]">
					<h2 class="text-[var(--gw-text-base)] font-semibold text-[var(--gw-color-text)]">Repos</h2>
					<span class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">{data.rigs.length}</span>
					<span class="ml-auto text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
						workspace: <strong>{data.activeWorkspace}</strong>
					</span>
				</div>

				{#if data.rigError}
					<aside class="warn-banner" role="alert">Could not list this workspace's repos: {data.rigError}</aside>
				{/if}

				<div class="bezel-core-overflow border border-[var(--gw-color-border-subtle)]">
					{#if data.rigs.length > 0}
						<div class="overflow-x-auto">
							<table class="w-full min-w-[760px] text-left">
								<thead>
									<tr class="border-b border-[var(--gw-color-border-subtle)]">
										<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Name</th>
										<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Prefix</th>
										<th class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)] md:table-cell">Git URL</th>
										<th class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)] lg:table-cell">Connection</th>
										<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Graph</th>
										<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Actions</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-[var(--gw-color-border-subtle)]">
									{#each data.rigs as rig (rig.name)}
										<tr class="data-row">
											<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
												<span class="text-[var(--gw-text-sm)] font-medium text-[var(--gw-color-text)]">{rig.name}</span>
											</td>
											<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]"><span class="chip">{rig.prefix}</span></td>
											<td class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] md:table-cell">
												<span class="block max-w-[260px] truncate font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]" title={rig.git_url}>{rig.git_url}</span>
											</td>
											<td class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] lg:table-cell">
												{#if rig.git_connection_ref}
													{#if connExists(rig.git_connection_ref)}
														<span class="chip" title="git_connection_ref">{rig.git_connection_ref}</span>
													{:else}
														<span class="chip chip-warn" title="Connection lost — reconnect in Actions">⚠ {rig.git_connection_ref}</span>
													{/if}
												{:else}
													<span class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">—</span>
												{/if}
											</td>
											<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
												{#key data.graphCustody}
													{@const chip = graphChip(rig.name)}
													<div class="graph-cell">
														{#if chip}
															<span class="chip chip-status" title={chip.commit ? `Last indexed commit: ${chip.commit}` : 'No indexed commit yet'}>
																<span class="dot dot-{chip.state}"></span>{CHIP_LABEL[chip.state]}
															</span>
														{:else}
															<span class="chip" title="No graph custody — run Refresh to build it"><span class="dot"></span>—</span>
														{/if}
														{#if data.canRefreshGraph}
															<form method="POST" action="?/refreshGraph" use:enhance={refreshEnhancer(rig.name)}>
																<input type="hidden" name="rig" value={rig.name} />
																<button type="submit" class="btn-refresh" disabled={refreshing === rig.name} title="Rebuild this repo's graph">
																	<Icon icon="lucide:refresh-cw" size={12} class={refreshing === rig.name ? 'spin' : ''} />
																	Refresh
																</button>
															</form>
														{/if}
													</div>
												{/key}
											</td>
											<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-right">
												<div class="flex items-center justify-end gap-[var(--gw-space-2)]">
													{#if rig.git_connection_ref && !connExists(rig.git_connection_ref) && appConnections.length > 0}
														<!-- One-click reconnect: pick a connection → remove + re-add with the new ref. -->
														<form method="POST" action="?/reconnectRig" use:enhance={enhancer} class="inline-flex">
															<input type="hidden" name="name" value={rig.name} />
															<input type="hidden" name="prefix" value={rig.prefix} />
															<input type="hidden" name="git_url" value={rig.git_url} />
															<input type="hidden" name="default_branch" value={rig.default_branch} />
															<input type="hidden" name="push_url" value={rig.push_url ?? ''} />
															<input type="hidden" name="upstream_url" value={rig.upstream_url ?? ''} />
															<select
																name="git_connection_ref"
																disabled={saving}
																class="rounded-[var(--gw-radius-md)] border border-[var(--gw-color-border)] bg-[var(--gw-color-surface-3)] px-[var(--gw-space-2)] py-[var(--gw-space-1)] text-[var(--gw-text-xs)] text-[var(--gw-color-text)]"
																title="Reconnect this repo to a connection"
																onchange={(e) => {
																	const sel = e.currentTarget as HTMLSelectElement;
																	if (sel.value) sel.form?.requestSubmit();
																}}
															>
																<option value="">Reconnect…</option>
																{#each appConnections as c (c.id)}
																	<option value={c.id}>{connLabel(c.id)}</option>
																{/each}
															</select>
														</form>
													{/if}
													<form
														method="POST"
														action="?/removeRig"
														use:enhance={enhancer}
														onsubmit={(e) => {
															if (!confirm(`Delete repo ${rig.name}?`)) e.preventDefault();
														}}
													>
														<input type="hidden" name="name" value={rig.name} />
														<button type="submit" class="btn-danger" disabled={saving}>Delete</button>
													</form>
												</div>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{:else}
						<div class="flex flex-col items-center justify-center gap-[var(--gw-space-2)] px-[var(--gw-space-6)] py-[var(--gw-space-10)]">
							<Icon icon="lucide:git-branch" size={20} />
							<p class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">No repos registered.</p>
						</div>
					{/if}
				</div>
			</div>
		</section>
	{/if}

</div>
