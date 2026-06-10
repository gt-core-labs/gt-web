<script lang="ts">
	import { enhance } from '$app/forms';
	import { hasScope } from '$lib/api/auth';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const canWrite = $derived(hasScope(data.user?.scopes, 'rig.write'));
	let saving = $state(false);

	const fv = $derived((form ?? {}) as Record<string, string | undefined>);

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

<style>
	@keyframes fade-up-in {
		from { opacity: 0; transform: translateY(10px); }
		to   { opacity: 1; transform: translateY(0); }
	}
	.entry   { animation: fade-up-in 480ms cubic-bezier(0.32, 0.72, 0, 1) both; }
	.entry-1 { animation-delay: 0ms; }
	.entry-2 { animation-delay: 60ms; }
	.entry-3 { animation-delay: 120ms; }

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
		            box-shadow   160ms cubic-bezier(0.32, 0.72, 0, 1);
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
	.cta:hover:not(:disabled) { opacity: 0.92; box-shadow: 0 6px 20px -2px oklch(60% 0.22 250 / 0.45); }
	.cta:active:not(:disabled) { transform: scale(0.98); }
	.cta:disabled { opacity: 0.4; cursor: not-allowed; }
	.cta-arrow {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 9999px;
		background-color: rgba(255, 255, 255, 0.18);
		font-size: 0.85rem;
		transition: transform 200ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.cta:hover:not(:disabled) .cta-arrow { transform: translateX(2px); }

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
		            background-color 150ms cubic-bezier(0.32, 0.72, 0, 1),
		            transform 150ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.btn-danger:hover:not(:disabled) { border-color: var(--gw-color-error); background-color: oklch(98% 0.015 25); }
	.btn-danger:active:not(:disabled) { transform: scale(0.97); }
	.btn-danger:disabled { opacity: 0.4; cursor: not-allowed; }

	.prefix-chip {
		display: inline-flex;
		align-items: center;
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

	.warn-banner {
		border-radius: var(--gw-radius-xl);
		border: 1px solid oklch(88% 0.1 80);
		background-color: oklch(97% 0.04 80);
		color: oklch(48% 0.18 80);
		font-size: var(--gw-text-xs);
		padding: var(--gw-space-3) var(--gw-space-4);
	}

	.data-row { transition: background-color 140ms cubic-bezier(0.32, 0.72, 0, 1); }
	.data-row:hover { background-color: var(--gw-color-surface-3); }
</style>

<div class="space-y-5">

	<!-- ── Header ──────────────────────────────────────────────────────────── -->
	<header class="entry entry-1 space-y-2">
		<span
			class="inline-flex items-center rounded-full border border-[var(--gw-color-border-subtle)]
				bg-[var(--gw-color-surface-3)] px-[var(--gw-space-3)] py-[3px]
				text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--gw-color-text-muted)]"
		>
			Admin
		</span>
		<div class="flex items-baseline gap-[var(--gw-space-2)]">
			<h1
				class="text-[var(--gw-text-3xl)] font-semibold leading-[var(--gw-leading-tight)]
					tracking-tight text-[var(--gw-color-text)]"
			>
				Rigs
			</h1>
			<span class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">
				{data.rigs.length}
			</span>
		</div>
	</header>

	<!-- ── Load error ──────────────────────────────────────────────────────── -->
	{#if data.loadError}
		<aside class="entry entry-2 warn-banner" role="alert">
			Could not load rigs for this workspace: {data.loadError}
		</aside>
	{/if}

	<!-- ── Form error ──────────────────────────────────────────────────────── -->
	{#if form?.error}
		<p class="entry entry-2 text-[var(--gw-text-xs)] text-[var(--gw-color-error)]">{form.error}</p>
	{/if}

	<!-- ── Register rig ────────────────────────────────────────────────────── -->
	{#if canWrite}
		<section class="entry entry-2 bezel" aria-label="Register rig">
			<div class="bezel-core px-[var(--gw-space-6)] py-[var(--gw-space-5)]">

				<div class="mb-[var(--gw-space-4)] flex items-center gap-[var(--gw-space-3)]">
					<div
						class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--gw-radius-lg)]
							border border-[var(--gw-color-border-subtle)] bg-[var(--gw-color-surface-3)]"
						aria-hidden="true"
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
							stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
							style="color: var(--gw-color-text-muted)">
							<circle cx="12" cy="12" r="3"/>
							<path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/>
							<path d="M15.54 8.46a5 5 0 010 7.07M8.46 8.46a5 5 0 000 7.07"/>
						</svg>
					</div>
					<h2 class="text-[var(--gw-text-base)] font-semibold text-[var(--gw-color-text)]">
						Register rig
					</h2>
				</div>

				<form
					method="POST"
					action="?/add"
					use:enhance={enhancer}
					class="max-w-2xl space-y-[var(--gw-space-4)]"
				>
					<!-- Row 1: name + prefix -->
					<div class="grid gap-[var(--gw-space-3)] sm:grid-cols-2">
						<div class="space-y-[var(--gw-space-1)]">
							<label
								for="rig-name"
								class="block text-[10px] font-semibold uppercase tracking-[0.12em]
									text-[var(--gw-color-text-muted)]"
							>
								Name
							</label>
							<input
								id="rig-name"
								class="gw-input"
								type="text"
								name="name"
								required
								bind:value={nameValue}
								oninput={() => (nameTouched = true)}
								placeholder="myrepo"
							/>
						</div>
						<div class="space-y-[var(--gw-space-1)]">
							<label
								for="rig-prefix"
								class="block text-[10px] font-semibold uppercase tracking-[0.12em]
									text-[var(--gw-color-text-muted)]"
							>
								Bead prefix
							</label>
							<input
								id="rig-prefix"
								class="gw-input"
								type="text"
								name="prefix"
								required
								placeholder="hq"
								bind:value={prefixValue}
								oninput={() => (prefixTouched = true)}
							/>
						</div>
					</div>

					<!-- Row 2: git URL (full width) -->
					<div class="space-y-[var(--gw-space-1)]">
						<label
							for="rig-git-url"
							class="block text-[10px] font-semibold uppercase tracking-[0.12em]
								text-[var(--gw-color-text-muted)]"
						>
							Git URL
						</label>
						<input
							id="rig-git-url"
							class="gw-input"
							type="text"
							name="git_url"
							required
							value={gitUrl}
							oninput={onGitUrlInput}
							placeholder="git@github.com:org/repo.git"
						/>
					</div>

					<!-- Row 3: branch + push URL + upstream URL -->
					<div class="grid gap-[var(--gw-space-3)] sm:grid-cols-3">
						<div class="space-y-[var(--gw-space-1)]">
							<label
								for="rig-branch"
								class="block text-[10px] font-semibold uppercase tracking-[0.12em]
									text-[var(--gw-color-text-muted)]"
							>
								Default branch
							</label>
							<input
								id="rig-branch"
								class="gw-input"
								type="text"
								name="default_branch"
								placeholder="main"
							/>
						</div>
						<div class="space-y-[var(--gw-space-1)]">
							<label
								for="rig-push-url"
								class="block text-[10px] font-semibold uppercase tracking-[0.12em]
									text-[var(--gw-color-text-muted)]"
							>
								Push URL
								<span class="normal-case tracking-normal opacity-60">(optional)</span>
							</label>
							<input
								id="rig-push-url"
								class="gw-input"
								type="text"
								name="push_url"
								placeholder="https://…"
							/>
						</div>
						<div class="space-y-[var(--gw-space-1)]">
							<label
								for="rig-upstream-url"
								class="block text-[10px] font-semibold uppercase tracking-[0.12em]
									text-[var(--gw-color-text-muted)]"
							>
								Upstream URL
								<span class="normal-case tracking-normal opacity-60">(optional)</span>
							</label>
							<input
								id="rig-upstream-url"
								class="gw-input"
								type="text"
								name="upstream_url"
								placeholder="https://…"
							/>
						</div>
					</div>

					<button type="submit" class="cta" disabled={saving}>
						{#if saving}
							<svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"/>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
							</svg>
							<span>Registering…</span>
						{:else}
							<span>Register rig</span>
							<span class="cta-arrow" aria-hidden="true">→</span>
						{/if}
					</button>

				</form>
			</div>
		</section>
	{/if}

	<!-- ── Rigs table ──────────────────────────────────────────────────────── -->
	<section class="entry entry-3 bezel" aria-label="Rigs list">
		<div class="bezel-core-overflow">
			{#if data.rigs.length > 0}
				<table class="w-full text-left">
					<thead>
						<tr class="border-b border-[var(--gw-color-border-subtle)]">
							<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Name</th>
							<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Prefix</th>
							<th class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)] md:table-cell">Git URL</th>
							<th class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)] sm:table-cell">Branch</th>
							{#if canWrite}
								<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-right text-[10px] font-semibold
									uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Actions</th>
							{/if}
						</tr>
					</thead>
					<tbody class="divide-y divide-[var(--gw-color-border-subtle)]">
						{#each data.rigs as rig (rig.name)}
							<tr class="data-row">
								<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
									<span class="text-[var(--gw-text-sm)] font-medium text-[var(--gw-color-text)]">
										{rig.name}
									</span>
								</td>
								<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
									<span class="prefix-chip">{rig.prefix}</span>
								</td>
								<td class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] md:table-cell">
									<span
										class="block max-w-[280px] truncate font-[family-name:var(--gw-font-mono)]
											text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]"
										title={rig.git_url}
									>
										{rig.git_url}
									</span>
								</td>
								<td class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] sm:table-cell">
									<span class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)]
										text-[var(--gw-color-text-muted)]">
										{rig.default_branch}
									</span>
								</td>
								{#if canWrite}
									<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-right">
										<form
											method="POST"
											action="?/remove"
											use:enhance={enhancer}
											onsubmit={(e) => {
												if (!confirm(`Remove rig ${rig.name}?`)) e.preventDefault();
											}}
										>
											<input type="hidden" name="name" value={rig.name} />
											<button type="submit" class="btn-danger" disabled={saving}>Remove</button>
										</form>
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<div
					class="flex flex-col items-center justify-center gap-[var(--gw-space-2)]
						px-[var(--gw-space-6)] py-[var(--gw-space-10)]"
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
						stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
						style="color: var(--gw-color-text-muted); opacity: 0.4" aria-hidden="true">
						<circle cx="12" cy="12" r="3"/>
						<path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/>
					</svg>
					<p class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">No rigs registered.</p>
				</div>
			{/if}
		</div>
	</section>

</div>
