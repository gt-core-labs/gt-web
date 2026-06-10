<script lang="ts">
	import { enhance } from '$app/forms';
	import { hasScope } from '$lib/api/auth';
	import type { WorkspaceStatus } from '$lib/api/admin';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const canWrite = $derived(hasScope(data.user?.scopes, 'workspace.write'));
	let saving = $state(false);

	const fv = $derived((form ?? {}) as Record<string, string | undefined>);

	const STATUS_STYLE: Record<WorkspaceStatus, { cls: string; dot: string }> = {
		active:    { cls: 'badge-active',    dot: 'bg-current' },
		suspended: { cls: 'badge-suspended', dot: 'bg-current' },
		archived:  { cls: 'badge-archived',  dot: '' },
	};

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

	.gw-check {
		appearance: none;
		width: 1rem;
		height: 1rem;
		border-radius: var(--gw-radius-sm);
		border: 1px solid var(--gw-color-border);
		background-color: var(--gw-color-surface-3);
		cursor: pointer;
		flex-shrink: 0;
		position: relative;
		transition: border-color 140ms cubic-bezier(0.32, 0.72, 0, 1),
		            background-color 140ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.gw-check:checked {
		border-color: oklch(60% 0.22 250);
		background: linear-gradient(135deg, oklch(60% 0.22 250), oklch(50% 0.24 270));
	}
	.gw-check:checked::after {
		content: '';
		position: absolute;
		left: 3px;
		top: 1px;
		width: 5px;
		height: 8px;
		border: 1.5px solid white;
		border-top: none;
		border-left: none;
		transform: rotate(45deg);
	}
	.gw-check:focus-visible {
		outline: 2px solid oklch(60% 0.22 250 / 0.5);
		outline-offset: 2px;
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

	.btn-tonal {
		display: inline-flex;
		align-items: center;
		border-radius: 9999px;
		border: 1px solid var(--gw-color-border);
		background-color: var(--gw-color-surface-3);
		color: var(--gw-color-text);
		font-size: var(--gw-text-xs);
		font-weight: 500;
		padding: 0.3125rem 0.75rem;
		cursor: pointer;
		transition: border-color 150ms cubic-bezier(0.32, 0.72, 0, 1),
		            background-color 150ms cubic-bezier(0.32, 0.72, 0, 1),
		            transform 150ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.btn-tonal:hover:not(:disabled) { border-color: var(--gw-color-primary); background-color: var(--gw-color-surface); }
	.btn-tonal:active:not(:disabled) { transform: scale(0.97); }
	.btn-tonal:disabled { opacity: 0.4; cursor: not-allowed; }

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

	/* Status badges */
	.badge-active {
		display: inline-flex; align-items: center; gap: 4px;
		border-radius: 9999px;
		background-color: oklch(96% 0.05 150); border: 1px solid oklch(85% 0.1 150);
		color: oklch(42% 0.16 150);
		font-size: 10px; font-weight: 600; padding: 2px 7px;
		text-transform: uppercase; letter-spacing: 0.06em;
	}
	.badge-suspended {
		display: inline-flex; align-items: center; gap: 4px;
		border-radius: 9999px;
		background-color: oklch(97% 0.04 80); border: 1px solid oklch(88% 0.1 80);
		color: oklch(52% 0.18 80);
		font-size: 10px; font-weight: 600; padding: 2px 7px;
		text-transform: uppercase; letter-spacing: 0.06em;
	}
	.badge-archived {
		display: inline-flex; align-items: center;
		border-radius: 9999px;
		background-color: var(--gw-color-surface-3); border: 1px solid var(--gw-color-border-subtle);
		color: var(--gw-color-text-muted);
		font-size: 10px; font-weight: 600; padding: 2px 7px;
		text-transform: uppercase; letter-spacing: 0.06em;
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
				Workspaces
			</h1>
			<span class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">
				{data.workspaces.length}
			</span>
		</div>
	</header>

	<!-- ── Global form feedback ────────────────────────────────────────────── -->
	{#if form?.error}
		<p class="entry entry-2 text-[var(--gw-text-xs)] text-[var(--gw-color-error)]">{form.error}</p>
	{/if}
	{#if form?.accountWarning}
		<p class="entry entry-2 text-[var(--gw-text-xs)]" style="color: oklch(52% 0.18 80)">
			{form.accountWarning}
		</p>
	{/if}

	<!-- ── Create workspace ─────────────────────────────────────────────────── -->
	{#if canWrite}
		<section class="entry entry-2 bezel" aria-label="Create workspace">
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
							<rect x="3" y="3" width="7" height="7" rx="1"/>
							<rect x="14" y="3" width="7" height="7" rx="1"/>
							<rect x="3" y="14" width="7" height="7" rx="1"/>
							<rect x="14" y="14" width="7" height="7" rx="1"/>
						</svg>
					</div>
					<h2 class="text-[var(--gw-text-base)] font-semibold text-[var(--gw-color-text)]">
						Create workspace
					</h2>
				</div>

				<form method="POST" action="?/create" use:enhance={enhancer} class="max-w-2xl space-y-[var(--gw-space-4)]">

					<div class="grid gap-[var(--gw-space-3)] sm:grid-cols-[1fr_2fr]">
						<div class="space-y-[var(--gw-space-1)]">
							<label
								for="ws-slug"
								class="block text-[10px] font-semibold uppercase tracking-[0.12em]
									text-[var(--gw-color-text-muted)]"
							>
								Slug
							</label>
							<input
								id="ws-slug"
								class="gw-input"
								type="text"
								name="id"
								required
								placeholder="acme"
								value={fv.id ?? ''}
							/>
						</div>
						<div class="space-y-[var(--gw-space-1)]">
							<label
								for="ws-name"
								class="block text-[10px] font-semibold uppercase tracking-[0.12em]
									text-[var(--gw-color-text-muted)]"
							>
								Display name
							</label>
							<input
								id="ws-name"
								class="gw-input"
								type="text"
								name="name"
								required
								value={fv.name ?? ''}
								placeholder="Acme Corp"
							/>
						</div>
					</div>

					<!-- Optional initial accounts -->
					{#if data.accountPool.length > 0}
						<fieldset class="space-y-[var(--gw-space-2)]">
							<span
								class="block text-[10px] font-semibold uppercase tracking-[0.12em]
									text-[var(--gw-color-text-muted)]"
							>
								Initial accounts
								<span class="normal-case tracking-normal opacity-60">(optional)</span>
							</span>
							<div
								class="rounded-[var(--gw-radius-xl)] border border-[var(--gw-color-border-subtle)]
									bg-[var(--gw-color-surface-3)] p-[var(--gw-space-3)]"
							>
								<div class="flex flex-wrap gap-x-[var(--gw-space-4)] gap-y-[var(--gw-space-2)]">
									{#each data.accountPool as acct (acct)}
										<label class="flex cursor-pointer items-center gap-[var(--gw-space-2)]">
											<input
												type="checkbox"
												class="gw-check"
												name="accounts"
												value={acct}
											/>
											<span
												class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)]
													text-[var(--gw-color-text)]"
											>
												{acct}
											</span>
										</label>
									{/each}
								</div>
							</div>
						</fieldset>
					{/if}

					<button type="submit" class="cta" disabled={saving}>
						{#if saving}
							<svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"/>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
							</svg>
							<span>Creating…</span>
						{:else}
							<span>Create workspace</span>
							<span class="cta-arrow" aria-hidden="true">→</span>
						{/if}
					</button>

				</form>
			</div>
		</section>
	{/if}

	<!-- ── Workspaces table ─────────────────────────────────────────────────── -->
	<section class="entry entry-3 bezel" aria-label="Workspaces list">
		<div class="bezel-core-overflow">
			{#if data.workspaces.length > 0}
				<table class="w-full text-left">
					<thead>
						<tr class="border-b border-[var(--gw-color-border-subtle)]">
							<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Slug</th>
							<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Name</th>
							<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Status</th>
							{#if canWrite}
								<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-right text-[10px] font-semibold
									uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Actions</th>
							{/if}
						</tr>
					</thead>
					<tbody class="divide-y divide-[var(--gw-color-border-subtle)]">
						{#each data.workspaces as ws (ws.id)}
							{@const style = STATUS_STYLE[ws.status]}
							<tr class="data-row">
								<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
									<span
										class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-sm)]
											font-medium text-[var(--gw-color-text)]"
									>
										{ws.id}
									</span>
								</td>
								<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
									<span class="text-[var(--gw-text-sm)] text-[var(--gw-color-text)]">
										{ws.name}
									</span>
								</td>
								<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
									<span class={style.cls}>
										{#if style.dot}
											<span class="h-1.5 w-1.5 rounded-full {style.dot}"></span>
										{/if}
										{ws.status}
									</span>
								</td>
								{#if canWrite}
									<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
										<span class="flex items-center justify-end gap-[var(--gw-space-2)]">
											{#if ws.status === 'active'}
												<form method="POST" action="?/suspend" use:enhance={enhancer}>
													<input type="hidden" name="id" value={ws.id} />
													<button type="submit" class="btn-tonal" disabled={saving}>
														Suspend
													</button>
												</form>
											{:else if ws.status === 'suspended'}
												<form method="POST" action="?/resume" use:enhance={enhancer}>
													<input type="hidden" name="id" value={ws.id} />
													<button type="submit" class="btn-tonal" disabled={saving}>
														Resume
													</button>
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
													<button type="submit" class="btn-danger" disabled={saving}>
														Archive
													</button>
												</form>
											{/if}
										</span>
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
						<rect x="3" y="3" width="7" height="7" rx="1"/>
						<rect x="14" y="3" width="7" height="7" rx="1"/>
						<rect x="3" y="14" width="7" height="7" rx="1"/>
						<rect x="14" y="14" width="7" height="7" rx="1"/>
					</svg>
					<p class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">No workspaces.</p>
				</div>
			{/if}
		</div>
	</section>

</div>
