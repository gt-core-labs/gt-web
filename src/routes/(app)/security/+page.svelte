<script lang="ts">
	import { enhance } from '$app/forms';
	import { hasScope } from '$lib/api/auth';
	import { buildGrantable, type CreatedPat } from '$lib/api/security';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const canWrite = $derived(hasScope(data.user?.scopes, 'tokens.write'));
	let saving = $state(false);

	const grantable = $derived(buildGrantable(data.user?.scopes));
	let picked = $state(new Set<string>());
	function toggle(scope: string, on: boolean) {
		const next = new Set(picked);
		if (on) next.add(scope);
		else next.delete(scope);
		picked = next;
	}
	const allPicked = $derived(grantable.length > 0 && grantable.every((o) => picked.has(o.scope)));
	function toggleAll(on: boolean) {
		picked = on ? new Set(grantable.map((o) => o.scope)) : new Set();
	}
	const scopesValue = $derived([...picked].join(' '));
	const fv = $derived((form ?? {}) as Record<string, string | undefined>);
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

<style>
	/* Entry animations */
	@keyframes fade-up-in {
		from { opacity: 0; transform: translateY(10px); }
		to   { opacity: 1; transform: translateY(0); }
	}
	.entry   { animation: fade-up-in 480ms cubic-bezier(0.32, 0.72, 0, 1) both; }
	.entry-1 { animation-delay: 0ms; }
	.entry-2 { animation-delay: 60ms; }
	.entry-3 { animation-delay: 120ms; }

	/* Double-Bezel — outer shell */
	.bezel {
		border-radius: var(--gw-radius-2xl);
		border: 1px solid var(--gw-color-border-subtle);
		background-color: var(--gw-color-surface-3);
		padding: 3px;
	}

	/* Double-Bezel — inner core */
	.bezel-core {
		border-radius: calc(var(--gw-radius-2xl) - 3px);
		background-color: var(--gw-color-surface);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
	}

	/* Double-Bezel — inner core with overflow clip (tables) */
	.bezel-core-overflow {
		border-radius: calc(var(--gw-radius-2xl) - 3px);
		background-color: var(--gw-color-surface);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
		overflow: hidden;
	}

	/* Premium input */
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

	/* Primary CTA — pill with nested trailing arrow */
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
		transition: opacity 200ms cubic-bezier(0.32, 0.72, 0, 1),
		            transform 200ms cubic-bezier(0.32, 0.72, 0, 1),
		            box-shadow 200ms cubic-bezier(0.32, 0.72, 0, 1);
		box-shadow: 0 4px 14px -2px oklch(60% 0.22 250 / 0.35);
	}
	.cta:hover:not(:disabled) {
		opacity: 0.92;
		box-shadow: 0 6px 20px -2px oklch(60% 0.22 250 / 0.45);
	}
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

	/* Ghost / secondary button */
	.btn-ghost {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		border-radius: 9999px;
		border: 1px solid var(--gw-color-border);
		background-color: var(--gw-color-surface-3);
		color: var(--gw-color-text);
		font-size: var(--gw-text-xs);
		font-weight: 500;
		padding: 0.375rem 0.875rem;
		cursor: pointer;
		transition: border-color 160ms cubic-bezier(0.32, 0.72, 0, 1),
		            background-color 160ms cubic-bezier(0.32, 0.72, 0, 1),
		            transform 160ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.btn-ghost:hover { border-color: var(--gw-color-primary); background-color: var(--gw-color-surface); }
	.btn-ghost:active { transform: scale(0.97); }

	/* Danger ghost button */
	.btn-danger {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		border-radius: 9999px;
		border: 1px solid var(--gw-color-border);
		background-color: var(--gw-color-surface-3);
		color: var(--gw-color-error);
		font-size: var(--gw-text-xs);
		font-weight: 500;
		padding: 0.375rem 0.875rem;
		cursor: pointer;
		transition: border-color 160ms cubic-bezier(0.32, 0.72, 0, 1),
		            background-color 160ms cubic-bezier(0.32, 0.72, 0, 1),
		            transform 160ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.btn-danger:hover {
		border-color: var(--gw-color-error);
		background-color: oklch(98% 0.015 25);
	}
	.btn-danger:active { transform: scale(0.97); }

	/* Custom checkbox */
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

	/* Scope pill / badge */
	.scope-pill {
		display: inline-flex;
		align-items: center;
		border-radius: 9999px;
		background-color: var(--gw-color-surface-3);
		border: 1px solid var(--gw-color-border-subtle);
		font-family: var(--gw-font-mono);
		font-size: 10px;
		padding: 1px 6px;
		color: var(--gw-color-text-muted);
	}

	/* Status badge */
	.badge-active {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		border-radius: 9999px;
		background-color: oklch(96% 0.05 150);
		border: 1px solid oklch(85% 0.1 150);
		color: oklch(42% 0.16 150);
		font-size: 10px;
		font-weight: 600;
		padding: 2px 7px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.badge-inactive {
		display: inline-flex;
		align-items: center;
		border-radius: 9999px;
		background-color: var(--gw-color-surface-3);
		border: 1px solid var(--gw-color-border-subtle);
		color: var(--gw-color-text-muted);
		font-size: 10px;
		font-weight: 600;
		padding: 2px 7px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	/* Token reveal banner */
	.token-banner {
		border-radius: var(--gw-radius-xl);
		border: 1px solid oklch(85% 0.1 150);
		background: oklch(97% 0.03 150);
		padding: var(--gw-space-4);
	}

	/* Token code block */
	.token-code {
		display: block;
		font-family: var(--gw-font-mono);
		font-size: var(--gw-text-xs);
		word-break: break-all;
		background-color: var(--gw-color-surface-3);
		border: 1px solid var(--gw-color-border-subtle);
		border-radius: var(--gw-radius-md);
		padding: 0.5rem 0.75rem;
		color: var(--gw-color-text);
	}

	/* Data table rows */
	.data-row {
		transition: background-color 140ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.data-row:hover {
		background-color: var(--gw-color-surface-3);
	}

	/* Section divider */
	.section-divider {
		height: 1px;
		background-color: var(--gw-color-border-subtle);
	}

	/* 2FA coming-soon chip */
	.coming-soon {
		display: inline-flex;
		align-items: center;
		border-radius: 9999px;
		background-color: oklch(96% 0.04 270);
		border: 1px solid oklch(88% 0.08 270);
		color: oklch(52% 0.18 270);
		font-size: 10px;
		font-weight: 600;
		padding: 2px 8px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
</style>

<div class="space-y-5">

	<!-- ── Header ──────────────────────────────────────────────────────────── -->
	<header class="entry entry-1 space-y-2">
		<span
			class="inline-flex items-center rounded-full border border-[var(--gw-color-border-subtle)]
				bg-[var(--gw-color-surface-3)] px-[var(--gw-space-3)] py-[3px]
				text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--gw-color-text-muted)]"
		>
			Account
		</span>
		<h1
			class="text-[var(--gw-text-3xl)] font-semibold leading-[var(--gw-leading-tight)]
				tracking-tight text-[var(--gw-color-text)]"
		>
			Security
		</h1>
		<p class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">
			Personal access tokens and account protection.
		</p>
	</header>

	<!-- ── Personal Access Tokens ──────────────────────────────────────────── -->
	<section class="entry entry-2 bezel" aria-label="Personal Access Tokens">
		<div class="bezel-core px-[var(--gw-space-6)] py-[var(--gw-space-5)]">

			<!-- Section header -->
			<div class="mb-[var(--gw-space-4)]">
				<div class="flex items-center gap-[var(--gw-space-3)]">
					<!-- Key icon -->
					<div
						class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--gw-radius-lg)]
							border border-[var(--gw-color-border-subtle)] bg-[var(--gw-color-surface-3)]"
						aria-hidden="true"
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
							stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
							style="color: var(--gw-color-text-muted)">
							<circle cx="7" cy="17" r="4"/>
							<path d="M10.85 14.15l7.15-7.15M17 3l4 4-2 2-4-4z"/>
							<path d="M15 5l4 4"/>
						</svg>
					</div>
					<div>
						<h2
							class="text-[var(--gw-text-base)] font-semibold leading-snug text-[var(--gw-color-text)]"
						>
							Personal Access Tokens
						</h2>
						<p class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
							Long-lived bearer tokens for scripts and CI. Treated like a password — limited to
							your own scopes.
						</p>
					</div>
				</div>
			</div>

			<!-- New token reveal banner (shown once after creation) -->
			{#if created}
				<div class="token-banner mb-[var(--gw-space-5)]">
					<div class="mb-[var(--gw-space-2)] flex items-center gap-2">
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
							stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
							style="color: oklch(42% 0.16 150); flex-shrink:0">
							<polyline points="20 6 9 17 4 12"/>
						</svg>
						<p class="text-[var(--gw-text-xs)] font-semibold" style="color: oklch(42% 0.16 150)">
							Token <span class="font-bold">"{created.info.name}"</span> created — copy it now,
							it will not be shown again.
						</p>
					</div>
					<div class="flex items-center gap-[var(--gw-space-2)]">
						<code class="token-code flex-1">{created.token}</code>
						<button type="button" class="btn-ghost flex-shrink-0" onclick={() => copy(created.token)}>
							{#if copied}
								<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
								Copied
							{:else}
								<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
									<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
									<path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
								</svg>
								Copy
							{/if}
						</button>
					</div>
				</div>
			{/if}

			<!-- Create form -->
			{#if canWrite}
				<form
					method="POST"
					action="?/create"
					use:enhance={() => {
						saving = true;
						return async ({ update }) => {
							await update({ reset: false });
							saving = false;
						};
					}}
					class="mb-[var(--gw-space-5)] max-w-2xl space-y-[var(--gw-space-4)]"
				>
					<input type="hidden" name="scopes" value={scopesValue} />

					<!-- Name + expiry row -->
					<div class="grid gap-[var(--gw-space-3)] sm:grid-cols-[2fr_1fr]">
						<div class="space-y-[var(--gw-space-1)]">
							<label
								for="pat-name"
								class="block text-[10px] font-semibold uppercase tracking-[0.12em]
									text-[var(--gw-color-text-muted)]"
							>
								Token name
							</label>
							<input
								id="pat-name"
								class="gw-input"
								type="text"
								name="name"
								required
								value={fv.name ?? ''}
								placeholder="ci-deploy"
							/>
						</div>
						<div class="space-y-[var(--gw-space-1)]">
							<label
								for="pat-expiry"
								class="block text-[10px] font-semibold uppercase tracking-[0.12em]
									text-[var(--gw-color-text-muted)]"
							>
								Expires
								<span class="normal-case tracking-normal opacity-60">(days, blank = never)</span>
							</label>
							<input
								id="pat-expiry"
								class="gw-input"
								type="number"
								name="expires_in_days"
								min="1"
								placeholder="90"
							/>
						</div>
					</div>

					<!-- Permissions fieldset -->
					<fieldset class="space-y-[var(--gw-space-2)]">
						<div class="flex items-center justify-between">
							<span class="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">
								Permissions
								<span class="ml-1 normal-case tracking-normal opacity-60">({picked.size} selected)</span>
							</span>
							{#if grantable.length > 0}
								<label class="flex cursor-pointer items-center gap-[var(--gw-space-2)]">
									<input
										type="checkbox"
										class="gw-check"
										checked={allPicked}
										onchange={(e) => toggleAll(e.currentTarget.checked)}
									/>
									<span class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
										Select all
									</span>
								</label>
							{/if}
						</div>

						<div
							class="rounded-[var(--gw-radius-xl)] border border-[var(--gw-color-border-subtle)]
								bg-[var(--gw-color-surface-3)] p-[var(--gw-space-3)]"
						>
							{#if grantable.length > 0}
								<div class="grid gap-x-[var(--gw-space-4)] gap-y-[var(--gw-space-2)] sm:grid-cols-2 lg:grid-cols-3">
									{#each grantable as o (o.scope)}
										<label class="flex cursor-pointer items-center gap-[var(--gw-space-2)]">
											<input
												type="checkbox"
												class="gw-check"
												checked={picked.has(o.scope)}
												onchange={(e) => toggle(o.scope, e.currentTarget.checked)}
											/>
											<span class="text-[var(--gw-text-xs)] text-[var(--gw-color-text)]">
												{o.label}
												<span class="font-[family-name:var(--gw-font-mono)] opacity-50 text-[10px]">
													{o.scope}
												</span>
											</span>
										</label>
									{/each}
								</div>
							{:else}
								<p class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
									You hold no grantable scopes.
								</p>
							{/if}
						</div>
					</fieldset>

					<div class="flex items-center gap-[var(--gw-space-3)]">
						<button type="submit" class="cta" disabled={saving || picked.size === 0}>
							{#if saving}
								<svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"/>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
								</svg>
								<span>Creating…</span>
							{:else}
								<span>Create token</span>
								<span class="cta-arrow" aria-hidden="true">→</span>
							{/if}
						</button>
						{#if form?.error}
							<p class="text-[var(--gw-text-xs)] text-[var(--gw-color-error)]">{form.error}</p>
						{/if}
					</div>
				</form>

				<div class="section-divider mb-[var(--gw-space-5)]"></div>
			{/if}

			<!-- Token table -->
			{#if data.tokens.length > 0}
				<div class="bezel">
					<div class="bezel-core-overflow">
						<table class="w-full text-left">
							<thead>
								<tr class="border-b border-[var(--gw-color-border-subtle)]">
									<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold
										uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Name</th>
									<th class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold
										uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)] md:table-cell">Scopes</th>
									<th class="hidden px-[var(--gw-space-3)] py-[var(--gw-space-3)] text-[10px] font-semibold
										uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)] sm:table-cell">Created</th>
									<th class="hidden px-[var(--gw-space-3)] py-[var(--gw-space-3)] text-[10px] font-semibold
										uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)] sm:table-cell">Expires</th>
									<th class="hidden px-[var(--gw-space-3)] py-[var(--gw-space-3)] text-[10px] font-semibold
										uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)] lg:table-cell">Last used</th>
									<th class="px-[var(--gw-space-3)] py-[var(--gw-space-3)] text-[10px] font-semibold
										uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Status</th>
									{#if canWrite}
										<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]"></th>
									{/if}
								</tr>
							</thead>
							<tbody class="divide-y divide-[var(--gw-color-border-subtle)]">
								{#each data.tokens as t (t.id)}
									<tr class="data-row">
										<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
											<span class="text-[var(--gw-text-sm)] font-medium text-[var(--gw-color-text)]">
												{t.name}
											</span>
										</td>
										<td class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] md:table-cell">
											<span class="flex flex-wrap gap-1">
												{#each t.scopes as s (s)}
													<span class="scope-pill">{s}</span>
												{/each}
											</span>
										</td>
										<td class="hidden px-[var(--gw-space-3)] py-[var(--gw-space-3)] sm:table-cell">
											<span class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)]
												text-[var(--gw-color-text-muted)]">
												{fmtDate(t.created_at)}
											</span>
										</td>
										<td class="hidden px-[var(--gw-space-3)] py-[var(--gw-space-3)] sm:table-cell">
											<span class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)]
												text-[var(--gw-color-text-muted)]">
												{fmtExpiry(t.expires_at)}
											</span>
										</td>
										<td class="hidden px-[var(--gw-space-3)] py-[var(--gw-space-3)] lg:table-cell">
											<span class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)]
												text-[var(--gw-color-text-muted)]">
												{fmtUsed(t.last_used_at)}
											</span>
										</td>
										<td class="px-[var(--gw-space-3)] py-[var(--gw-space-3)]">
											{#if t.status === 'active'}
												<span class="badge-active">
													<span class="h-1.5 w-1.5 rounded-full bg-current"></span>
													Active
												</span>
											{:else}
												<span class="badge-inactive">{t.status}</span>
											{/if}
										</td>
										{#if canWrite}
											<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-right">
												{#if t.status === 'active'}
													<form
														method="POST"
														action="?/revoke"
														use:enhance={() => async ({ update }) => update()}
													>
														<input type="hidden" name="id" value={t.id} />
														<button type="submit" class="btn-danger">Revoke</button>
													</form>
												{/if}
											</td>
										{/if}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{:else}
				<div
					class="flex flex-col items-center justify-center gap-[var(--gw-space-2)] rounded-[var(--gw-radius-xl)]
						border border-dashed border-[var(--gw-color-border-subtle)] py-[var(--gw-space-8)]"
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
						stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
						style="color: var(--gw-color-text-muted); opacity: 0.5" aria-hidden="true">
						<circle cx="7" cy="17" r="4"/>
						<path d="M10.85 14.15l7.15-7.15M17 3l4 4-2 2-4-4z"/>
					</svg>
					<p class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">
						No tokens yet.
					</p>
				</div>
			{/if}

		</div>
	</section>

	<!-- ── Two-Factor Authentication ───────────────────────────────────────── -->
	<section class="entry entry-3 bezel" aria-label="Two-Factor Authentication">
		<div class="bezel-core px-[var(--gw-space-6)] py-[var(--gw-space-5)]">
			<div class="flex items-center gap-[var(--gw-space-3)]">
				<!-- Shield icon -->
				<div
					class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--gw-radius-lg)]
						border border-[var(--gw-color-border-subtle)] bg-[var(--gw-color-surface-3)]"
					aria-hidden="true"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
						stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
						style="color: var(--gw-color-text-muted)">
						<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
					</svg>
				</div>
				<div class="flex-1">
					<div class="flex flex-wrap items-center gap-[var(--gw-space-2)]">
						<h2
							class="text-[var(--gw-text-base)] font-semibold leading-snug text-[var(--gw-color-text)]"
						>
							Two-Factor Authentication
						</h2>
						<span class="coming-soon">Coming soon</span>
					</div>
					<p class="mt-[2px] text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
						Add a second factor (TOTP) to your account for stronger protection.
					</p>
				</div>
			</div>
		</div>
	</section>

</div>
