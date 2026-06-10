<script lang="ts">
	import { enhance } from '$app/forms';
	import { hasScope } from '$lib/api/auth';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const canWrite = $derived(hasScope(data.user?.scopes, 'users.write'));
	let saving = $state(false);

	const fv = $derived((form ?? {}) as Record<string, string | undefined>);
	const fmtDate = (secs: number) => new Date(secs * 1000).toLocaleDateString();
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

	.data-row {
		transition: background-color 140ms cubic-bezier(0.32, 0.72, 0, 1);
	}
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
				Users
			</h1>
			<span class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">
				{data.users.length}
			</span>
		</div>
	</header>

	<!-- ── Create user ─────────────────────────────────────────────────────── -->
	{#if canWrite}
		<section class="entry entry-2 bezel" aria-label="Create user">
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
							<path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/>
							<circle cx="9" cy="7" r="4"/>
							<line x1="19" y1="8" x2="19" y2="14"/>
							<line x1="22" y1="11" x2="16" y2="11"/>
						</svg>
					</div>
					<h2 class="text-[var(--gw-text-base)] font-semibold text-[var(--gw-color-text)]">
						Create user
					</h2>
				</div>

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
					class="max-w-2xl space-y-[var(--gw-space-4)]"
				>
					<div class="grid gap-[var(--gw-space-3)] sm:grid-cols-[1fr_1fr_2fr]">
						<div class="space-y-[var(--gw-space-1)]">
							<label
								for="user-email"
								class="block text-[10px] font-semibold uppercase tracking-[0.12em]
									text-[var(--gw-color-text-muted)]"
							>
								Email
							</label>
							<input
								id="user-email"
								class="gw-input"
								type="email"
								name="email"
								required
								value={fv.email ?? ''}
								placeholder="user@example.com"
							/>
						</div>
						<div class="space-y-[var(--gw-space-1)]">
							<label
								for="user-password"
								class="block text-[10px] font-semibold uppercase tracking-[0.12em]
									text-[var(--gw-color-text-muted)]"
							>
								Password
							</label>
							<input
								id="user-password"
								class="gw-input"
								type="password"
								name="password"
								required
								placeholder="••••••••"
							/>
						</div>
						<div class="space-y-[var(--gw-space-1)]">
							<label
								for="user-scopes"
								class="block text-[10px] font-semibold uppercase tracking-[0.12em]
									text-[var(--gw-color-text-muted)]"
							>
								Scopes
								<span class="normal-case tracking-normal opacity-60">(space or comma separated)</span>
							</label>
							<input
								id="user-scopes"
								class="gw-input"
								type="text"
								name="scopes"
								placeholder="issues.read documents.read"
							/>
						</div>
					</div>

					<div class="flex items-center gap-[var(--gw-space-3)]">
						<button type="submit" class="cta" disabled={saving}>
							{#if saving}
								<svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"/>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
								</svg>
								<span>Creating…</span>
							{:else}
								<span>Create user</span>
								<span class="cta-arrow" aria-hidden="true">→</span>
							{/if}
						</button>

						{#if form?.error}
							<p class="text-[var(--gw-text-xs)] text-[var(--gw-color-error)]">{form.error}</p>
						{/if}
						{#if form?.ok}
							<span
								class="flex items-center gap-[var(--gw-space-1)] text-[var(--gw-text-xs)]"
								style="color: oklch(42% 0.16 150)"
							>
								<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
									stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
									<polyline points="20 6 9 17 4 12"/>
								</svg>
								User created.
							</span>
						{/if}
					</div>
				</form>

			</div>
		</section>
	{/if}

	<!-- ── Users table ─────────────────────────────────────────────────────── -->
	<section class="entry entry-3 bezel" aria-label="Users list">
		<div class="bezel-core-overflow">
			{#if data.users.length > 0}
				<table class="w-full text-left">
					<thead>
						<tr class="border-b border-[var(--gw-color-border-subtle)]">
							<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Email</th>
							<th class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)] md:table-cell">Subject</th>
							<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Scopes</th>
							<th class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-right text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)] sm:table-cell">Created</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-[var(--gw-color-border-subtle)]">
						{#each data.users as u (u.sub)}
							<tr class="data-row">
								<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
									<span class="text-[var(--gw-text-sm)] font-medium text-[var(--gw-color-text)]">
										{u.email}
									</span>
								</td>
								<td class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] md:table-cell">
									<span class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)]
										text-[var(--gw-color-text-muted)]">
										{u.sub}
									</span>
								</td>
								<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
									<span class="flex flex-wrap gap-1">
										{#each u.scopes as s (s)}
											<span class="scope-pill">{s}</span>
										{/each}
									</span>
								</td>
								<td class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-right sm:table-cell">
									<span class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)]
										text-[var(--gw-color-text-muted)]">
										{fmtDate(u.created_at)}
									</span>
								</td>
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
						<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
						<circle cx="9" cy="7" r="4"/>
						<path d="M23 21v-2a4 4 0 00-3-3.87"/>
						<path d="M16 3.13a4 4 0 010 7.75"/>
					</svg>
					<p class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">No users.</p>
				</div>
			{/if}
		</div>
	</section>

</div>
