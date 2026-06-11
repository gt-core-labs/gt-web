<script lang="ts">
	import { enhance } from '$app/forms';
	import { hasScope } from '$lib/api/auth';
	import { Icon } from '$lib/ui';
	import { browserConnection, type GithubRepo } from '$lib/api/connection';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const canRigWrite = $derived(hasScope(data.user?.scopes, 'rig.write'));

	let saving = $state(false);
	const enhancer = () => {
		saving = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			saving = false;
		};
	};

	// github_app connections feed the repo picker; a PAT is a manual-URL fallback.
	const appConnections = $derived(data.connections.filter((c) => c.kind === 'github_app'));
	const otherWorkspaces = $derived(
		(data.workspaces ?? []).filter((w) => w.workspace !== data.activeWorkspace)
	);

	// ── Register form state ──────────────────────────────────────────────────
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

	function slugFromUrl(url: string): string {
		return url.replace(/\.git$/, '').split(/[/:]/).pop() ?? '';
	}
	// Rig names can't contain hyphens (bead-id delimiter); name = repo slug w/o hyphens, prefix mirrors.
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

	// ── Per-rig graph freshness chip ─────────────────────────────────────────
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

<div class="mx-auto max-w-4xl space-y-6">
	<header class="flex items-start gap-4">
		<div
			class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl
				border border-[var(--gw-color-border)] bg-[var(--gw-color-surface-3)] text-[var(--gw-color-text)]"
		>
			<Icon icon="lucide:git-branch" size={24} />
		</div>
		<div class="min-w-0">
			<h1 class="text-2xl font-semibold tracking-tight text-[var(--gw-color-text)]">Rigs</h1>
			<p class="mt-1 text-sm text-[var(--gw-color-text-muted)]">
				Repos registered in the active workspace. Switch workspace in the header to manage another.
				Connect a GitHub App under
				<a href="/complementos/github" class="underline">Add-ons → GitHub</a>.
			</p>
		</div>
	</header>

	{#if form?.error}
		<aside class="warn-banner" role="alert">{form.error}</aside>
	{/if}

	<section class="bezel" aria-label="Rigs">
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

			<!-- Register repo -->
			{#if canRigWrite}
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
							<select
								id="repo-pick"
								class="gw-input"
								disabled={!connRef || reposLoading || repos.length === 0}
								bind:value={selectedRepo}
								onchange={onRepoChange}
							>
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

					<div class="grid gap-[var(--gw-space-3)] sm:grid-cols-2">
						<div class="space-y-[var(--gw-space-1)]">
							<label class="label" for="repo-name">Name</label>
							<input id="repo-name" class="gw-input" type="text" name="name" required bind:value={nameValue} oninput={onNameInput} placeholder="myrepo" />
						</div>
						<div class="space-y-[var(--gw-space-1)]">
							<label class="label" for="repo-prefix">Bead prefix</label>
							<input id="repo-prefix" class="gw-input" type="text" name="prefix" required bind:value={prefixValue} oninput={() => (prefixTouched = true)} placeholder="myrepo" />
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
						{#if saving}
							<svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" />
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
							</svg>
							<span>Registering…</span>
						{:else}
							<span>Register repo</span>
							<span class="cta-arrow" aria-hidden="true">→</span>
						{/if}
					</button>
				</form>
			{/if}

			<!-- Repos table -->
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
									{#if canRigWrite}
										<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Actions</th>
									{/if}
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
												<span class="chip" title="git_connection_ref">{rig.git_connection_ref}</span>
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
										{#if canRigWrite}
											<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-right">
												<div class="flex items-center justify-end gap-[var(--gw-space-2)]">
													{#if otherWorkspaces.length > 0}
														<!-- Move the rig to another workspace (add in target → remove here). -->
														<form method="POST" action="?/moveRig" use:enhance={enhancer} class="inline-flex">
															<input type="hidden" name="name" value={rig.name} />
															<input type="hidden" name="prefix" value={rig.prefix} />
															<input type="hidden" name="git_url" value={rig.git_url} />
															<input type="hidden" name="default_branch" value={rig.default_branch} />
															<input type="hidden" name="push_url" value={rig.push_url ?? ''} />
															<input type="hidden" name="upstream_url" value={rig.upstream_url ?? ''} />
															<input type="hidden" name="git_connection_ref" value={rig.git_connection_ref ?? ''} />
															<select
																name="workspace"
																disabled={saving}
																class="rounded-[var(--gw-radius-md)] border border-[var(--gw-color-border)] bg-[var(--gw-color-surface-3)] px-[var(--gw-space-2)] py-[var(--gw-space-1)] text-[var(--gw-text-xs)] text-[var(--gw-color-text)]"
																title="Move this repo to another workspace"
																onchange={(e) => {
																	const sel = e.currentTarget as HTMLSelectElement;
																	if (!sel.value) return;
																	if (confirm(`Move ${rig.name} to ${sel.value}? (re-created there and removed from ${data.activeWorkspace})`))
																		sel.form?.requestSubmit();
																	else sel.value = '';
																}}
															>
																<option value="">Move to…</option>
																{#each otherWorkspaces as w (w.workspace)}
																	<option value={w.workspace}>{w.workspace}</option>
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
										{/if}
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
</div>

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
	}
	.btn-danger:hover:not(:disabled) {
		border-color: var(--gw-color-error);
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
	.dot {
		width: 6px;
		height: 6px;
		border-radius: 9999px;
		background-color: var(--gw-color-text-muted);
		opacity: 0.6;
	}
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
