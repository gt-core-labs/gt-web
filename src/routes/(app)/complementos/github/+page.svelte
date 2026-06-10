<script lang="ts">
	import { enhance } from '$app/forms';
	import { hasScope } from '$lib/api/auth';
	import { Icon } from '$lib/ui';
	import { browserConnection, GITHUB_INSTALL_URL, type GithubRepo } from '$lib/api/connection';
	import { findComplemento } from '$lib/complementos/manifest';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const meta = findComplemento('github');

	const canConnWrite = $derived(hasScope(data.user?.scopes, 'connection.write'));
	const canRigWrite = $derived(hasScope(data.user?.scopes, 'rig.write'));

	const fv = $derived((form ?? {}) as Record<string, string | undefined>);
	const formScope = $derived(fv.formScope);

	let saving = $state(false);
	const enhancer = () => {
		saving = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			saving = false;
		};
	};

	// GitHub App connections are the ones whose repos we can list; a PAT is a fallback.
	const appConnections = $derived(data.connections.filter((c) => c.kind === 'github_app'));

	// ── Repo register form state ─────────────────────────────────────────────
	let gitUrl = $state(fv.git_url ?? '');
	let nameValue = $state(fv.name ?? '');
	let prefixValue = $state(fv.prefix ?? '');
	let nameTouched = $state(!!fv.name);
	let prefixTouched = $state(!!fv.prefix);

	// Connection-aware picker: choose a connection → its repos populate the dropdown →
	// picking a repo fills git_url + git_connection_ref. Free-text git_url stays as fallback.
	let connRef = $state('');
	let repos = $state<GithubRepo[]>([]);
	let reposLoading = $state(false);
	let reposError = $state<string | null>(null);
	let selectedRepo = $state('');

	function slugFromUrl(url: string): string {
		return url.replace(/\.git$/, '').split(/[/:]/).pop() ?? '';
	}

	// Rig names can't contain hyphens (bead-id delimiter), so the name is the repo slug
	// with hyphens stripped; the prefix mirrors the name (prefix == name standard).
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

	// When the chosen connection changes, fetch its repos. The repos endpoint (bead .2)
	// 404s until the backend lands — degrade silently to the free-text fallback.
	async function onConnChange(e: Event) {
		connRef = (e.target as HTMLSelectElement).value;
		selectedRepo = '';
		repos = [];
		reposError = null;
		if (!connRef) return;
		reposLoading = true;
		try {
			repos = await browserConnection().githubRepos();
		} catch (err) {
			reposError =
				err && typeof err === 'object' && 'status' in err
					? `No se pudieron listar los repos (${(err as { status: number }).status}). Usa la URL manual.`
					: 'No se pudieron listar los repos. Usa la URL manual.';
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

	// ── Per-repo graph freshness (hq-vcs-connections.9) ──────────────────────
	// The warden custody is keyed by rig name; map each repo row to its freshness chip. The state is
	// derived from custody exactly as the backend does: not stale → built; stale + indexed before →
	// behind; stale + never indexed → stale. A rig with no custody (never refreshed) shows `—`.
	type GraphChip = { state: 'built' | 'behind' | 'stale'; commit: string | null } | null;
	function graphChip(rigName: string): GraphChip {
		const c = data.graphCustody.find((g) => g.rig === rigName);
		if (!c) return null;
		const state = !c.stale ? 'built' : c.last_indexed_commit ? 'behind' : 'stale';
		return { state, commit: c.last_indexed_commit };
	}
	const CHIP_LABEL = { built: 'Construido', behind: 'Atrasado', stale: 'Sin construir' } as const;

	// One in-flight rig at a time for the Refresh button's spinner.
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
		href="/complementos"
		class="inline-flex items-center gap-1.5 text-sm text-[var(--gw-color-text-muted)]
			no-underline transition-colors hover:text-[var(--gw-color-text)]"
	>
		<Icon icon="lucide:arrow-left" size={15} />
		Complementos
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
					'Conecta una GitHub App y registra repos privados para indexar su grafo.'}
			</p>
		</div>
	</header>

	{#if form?.error}
		<p class="text-[var(--gw-text-xs)] text-[var(--gw-color-error)]">{form.error}</p>
	{/if}

	<!-- ══ ZONA 1 · CONEXIONES ═══════════════════════════════════════════════ -->
	<section class="bezel" aria-label="Conexiones">
		<div class="bezel-core px-[var(--gw-space-6)] py-[var(--gw-space-5)] space-y-[var(--gw-space-4)]">
			<div class="flex items-center justify-between gap-3">
				<h2 class="text-[var(--gw-text-base)] font-semibold text-[var(--gw-color-text)]">
					Conexiones
				</h2>
				{#if canConnWrite}
					<button
						type="button"
						class="btn-secondary"
						onclick={() => (window.location.href = GITHUB_INSTALL_URL)}
					>
						<Icon icon="lucide:github" size={15} />
						Connect GitHub
					</button>
				{/if}
			</div>

			{#if data.connError}
				<aside class="warn-banner" role="alert">
					No se pudieron listar las conexiones: {data.connError}
				</aside>
			{/if}

			<!-- Connection list -->
			{#if data.connections.length > 0}
				<div class="bezel-core-overflow border border-[var(--gw-color-border-subtle)]">
					<table class="w-full text-left">
						<thead>
							<tr class="border-b border-[var(--gw-color-border-subtle)]">
								<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Id</th>
								<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Tipo</th>
								<th class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)] sm:table-cell">Cuenta</th>
								<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Estado</th>
								{#if canConnWrite}
									<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Acciones</th>
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
													if (!confirm(`¿Desconectar ${c.id}?`)) e.preventDefault();
												}}
											>
												<input type="hidden" name="id" value={c.id} />
												<button type="submit" class="btn-danger" disabled={saving}>Desconectar</button>
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
					Aún no hay conexiones. Conecta una GitHub App o registra un PAT abajo.
				</p>
			{/if}

			<!-- PAT fallback -->
			{#if canConnWrite}
				<details class="rounded-[var(--gw-radius-lg)] border border-[var(--gw-color-border-subtle)] bg-[var(--gw-color-surface-3)] px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
					<summary class="cursor-pointer text-[var(--gw-text-sm)] font-medium text-[var(--gw-color-text)]">
						Usar un Personal Access Token (fallback)
					</summary>
					<form
						method="POST"
						action="?/connectPat"
						use:enhance={enhancer}
						class="mt-[var(--gw-space-3)] space-y-[var(--gw-space-3)]"
					>
						<div class="grid gap-[var(--gw-space-3)] sm:grid-cols-2">
							<div class="space-y-[var(--gw-space-1)]">
								<label class="label" for="pat-id">Id de conexión</label>
								<input id="pat-id" class="gw-input" type="text" name="id" required placeholder="mi-pat" />
							</div>
							<div class="space-y-[var(--gw-space-1)]">
								<label class="label" for="pat-account">
									Cuenta / org <span class="normal-case tracking-normal opacity-60">(opcional)</span>
								</label>
								<input id="pat-account" class="gw-input" type="text" name="account_login" placeholder="mi-org" />
							</div>
						</div>
						<div class="space-y-[var(--gw-space-1)]">
							<label class="label" for="pat-secret">Token</label>
							<input id="pat-secret" class="gw-input" type="password" name="secret" required placeholder="ghp_…" autocomplete="off" />
							<p class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
								Se sella en reposo (AES-GCM) y nunca se devuelve. La GitHub App es preferible: tokens efímeros, sin secreto persistido.
							</p>
						</div>
						<button type="submit" class="cta" disabled={saving}>
							<span>Guardar PAT</span>
							<span class="cta-arrow" aria-hidden="true">→</span>
						</button>
					</form>
				</details>
			{/if}
		</div>
	</section>

	<!-- ══ ZONA 2 · REPOS ════════════════════════════════════════════════════ -->
	{#if data.canReadRigs}
		<section class="bezel" aria-label="Repos">
			<div class="bezel-core px-[var(--gw-space-6)] py-[var(--gw-space-5)] space-y-[var(--gw-space-4)]">
				<div class="flex items-baseline gap-[var(--gw-space-2)]">
					<h2 class="text-[var(--gw-text-base)] font-semibold text-[var(--gw-color-text)]">Repos</h2>
					<span class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">{data.rigs.length}</span>
				</div>

				{#if data.rigError}
					<aside class="warn-banner" role="alert">
						No se pudieron listar los repos de este workspace: {data.rigError}
					</aside>
				{/if}

				<!-- Register repo -->
				{#if canRigWrite}
					<form
						method="POST"
						action="?/addRig"
						use:enhance={enhancer}
						class="space-y-[var(--gw-space-4)] rounded-[var(--gw-radius-lg)] border border-[var(--gw-color-border-subtle)] bg-[var(--gw-color-surface-3)] p-[var(--gw-space-4)]"
					>
						<!-- Connection-aware picker -->
						<div class="grid gap-[var(--gw-space-3)] sm:grid-cols-2">
							<div class="space-y-[var(--gw-space-1)]">
								<label class="label" for="repo-conn">Conexión</label>
								<select
									id="repo-conn"
									class="gw-input"
									name="git_connection_ref"
									bind:value={connRef}
									onchange={onConnChange}
								>
									<option value="">Sin conexión (URL manual)</option>
									{#each appConnections as c (c.id)}
										<option value={c.id}>{connLabel(c.id)}</option>
									{/each}
								</select>
							</div>
							<div class="space-y-[var(--gw-space-1)]">
								<label class="label" for="repo-pick">Repositorio</label>
								<select
									id="repo-pick"
									class="gw-input"
									disabled={!connRef || reposLoading || repos.length === 0}
									bind:value={selectedRepo}
									onchange={onRepoChange}
								>
									{#if reposLoading}
										<option value="">Cargando…</option>
									{:else if !connRef}
										<option value="">Elige una conexión primero</option>
									{:else if repos.length === 0}
										<option value="">Sin repos (usa la URL manual)</option>
									{:else}
										<option value="">Elige un repo…</option>
										{#each repos as r (r.full_name)}
											<option value={r.full_name}>{r.full_name}{r.private ? ' · privado' : ''}</option>
										{/each}
									{/if}
								</select>
							</div>
						</div>
						{#if reposError}
							<p class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">{reposError}</p>
						{/if}

						<!-- name + prefix -->
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

						<!-- git URL (free-text fallback; auto-filled by the repo picker) -->
						<div class="space-y-[var(--gw-space-1)]">
							<label class="label" for="repo-git-url">
								Git URL <span class="normal-case tracking-normal opacity-60">(auto desde el repo, o manual)</span>
							</label>
							<input id="repo-git-url" class="gw-input" type="text" name="git_url" required value={gitUrl} oninput={onGitUrlInput} placeholder="git@github.com:org/repo.git" />
						</div>

						<!-- branch + push + upstream -->
						<div class="grid gap-[var(--gw-space-3)] sm:grid-cols-3">
							<div class="space-y-[var(--gw-space-1)]">
								<label class="label" for="repo-branch">Default branch</label>
								<input id="repo-branch" class="gw-input" type="text" name="default_branch" placeholder="main" />
							</div>
							<div class="space-y-[var(--gw-space-1)]">
								<label class="label" for="repo-push">Push URL <span class="normal-case tracking-normal opacity-60">(opcional)</span></label>
								<input id="repo-push" class="gw-input" type="text" name="push_url" placeholder="https://…" />
							</div>
							<div class="space-y-[var(--gw-space-1)]">
								<label class="label" for="repo-upstream">Upstream URL <span class="normal-case tracking-normal opacity-60">(opcional)</span></label>
								<input id="repo-upstream" class="gw-input" type="text" name="upstream_url" placeholder="https://…" />
							</div>
						</div>

						<button type="submit" class="cta" disabled={saving}>
							{#if saving}
								<svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" />
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
								</svg>
								<span>Registrando…</span>
							{:else}
								<span>Registrar repo</span>
								<span class="cta-arrow" aria-hidden="true">→</span>
							{/if}
						</button>
					</form>
				{/if}

				<!-- Repos table -->
				<div class="bezel-core-overflow border border-[var(--gw-color-border-subtle)]">
					{#if data.rigs.length > 0}
						<table class="w-full text-left">
							<thead>
								<tr class="border-b border-[var(--gw-color-border-subtle)]">
									<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Name</th>
									<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Prefix</th>
									<th class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)] md:table-cell">Git URL</th>
									<th class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)] lg:table-cell">Conexión</th>
									<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Grafo</th>
									{#if canRigWrite}
										<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Acciones</th>
									{/if}
								</tr>
							</thead>
							<tbody class="divide-y divide-[var(--gw-color-border-subtle)]">
								{#each data.rigs as rig (rig.name)}
									<tr class="data-row">
										<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
											<span class="text-[var(--gw-text-sm)] font-medium text-[var(--gw-color-text)]">{rig.name}</span>
										</td>
										<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
											<span class="chip">{rig.prefix}</span>
										</td>
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
											<!-- Per-repo graph freshness chip + Refresh (hq-vcs-connections.9). The state
											     comes from the warden custody (built/behind/stale), or `—` when the rig
											     has no custody yet (never refreshed). Default-branch-only. -->
											{#key data.graphCustody}
												{@const chip = graphChip(rig.name)}
												<div class="graph-cell">
													{#if chip}
														<span
															class="chip chip-status"
															title={chip.commit
																? `Último commit indexado: ${chip.commit}`
																: 'Aún sin commit indexado'}
														>
															<span class="dot dot-{chip.state}"></span>{CHIP_LABEL[chip.state]}
														</span>
													{:else}
														<span class="chip" title="Sin custodia del grafo — ejecuta Refresh para construirlo">
															<span class="dot"></span>—
														</span>
													{/if}
													{#if data.canRefreshGraph}
														<form method="POST" action="?/refreshGraph" use:enhance={refreshEnhancer(rig.name)}>
															<input type="hidden" name="rig" value={rig.name} />
															<button
																type="submit"
																class="btn-refresh"
																disabled={refreshing === rig.name}
																title="Reconstruir el grafo de este repo"
															>
																<Icon
																	icon="lucide:refresh-cw"
																	size={12}
																	class={refreshing === rig.name ? 'spin' : ''}
																/>
																Refresh
															</button>
														</form>
													{/if}
												</div>
											{/key}
										</td>
										{#if canRigWrite}
											<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-right">
												<form
													method="POST"
													action="?/removeRig"
													use:enhance={enhancer}
													onsubmit={(e) => {
														if (!confirm(`¿Eliminar el repo ${rig.name}?`)) e.preventDefault();
													}}
												>
													<input type="hidden" name="name" value={rig.name} />
													<button type="submit" class="btn-danger" disabled={saving}>Eliminar</button>
												</form>
											</td>
										{/if}
									</tr>
								{/each}
							</tbody>
						</table>
					{:else}
						<div class="flex flex-col items-center justify-center gap-[var(--gw-space-2)] px-[var(--gw-space-6)] py-[var(--gw-space-10)]">
							<Icon icon="lucide:git-branch" size={20} />
							<p class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">No hay repos registrados.</p>
						</div>
					{/if}
				</div>
			</div>
		</section>
	{/if}
</div>
