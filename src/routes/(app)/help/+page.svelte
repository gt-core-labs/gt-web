<script lang="ts">
	import { enhance } from '$app/forms';
	import { hasScope } from '$lib/api/auth';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const canReport = $derived(hasScope(data.user?.scopes, 'meta.write'));

	let gapOperation = $state('');
	let filter = $state('');
	const tools = $derived(
		data.tools
			.filter((t) => {
				const q = filter.trim().toLowerCase();
				if (!q) return true;
				return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
			})
			.sort((a, b) => a.name.localeCompare(b.name))
	);

	let saving = $state(false);
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

	/* Double-bezel — glass plate in an aluminium tray */
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

	/* Inputs */
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
	.gw-input::placeholder { color: var(--gw-color-text-muted); opacity: 0.55; }
	.gw-textarea { resize: vertical; min-height: 4.5rem; line-height: 1.5; }

	/* Search input with leading glyph */
	.search-wrap { position: relative; }
	.search-wrap .gw-input { padding-left: 2.25rem; }
	.search-icon {
		position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%);
		color: var(--gw-color-text-muted); opacity: 0.6; pointer-events: none;
	}

	/* Primary CTA */
	.cta {
		display: inline-flex; align-items: center; gap: 0.5rem;
		border-radius: 9999px; border: none;
		background: linear-gradient(135deg, oklch(60% 0.22 250), oklch(50% 0.24 270));
		color: white; font-size: var(--gw-text-sm); font-weight: 600;
		padding: 0.5625rem 1.25rem; cursor: pointer; white-space: nowrap;
		transition: opacity 200ms cubic-bezier(0.32, 0.72, 0, 1),
		            transform 200ms cubic-bezier(0.32, 0.72, 0, 1),
		            box-shadow 200ms cubic-bezier(0.32, 0.72, 0, 1);
		box-shadow: 0 4px 14px -2px oklch(60% 0.22 250 / 0.35);
	}
	.cta:hover:not(:disabled) { opacity: 0.92; box-shadow: 0 6px 20px -2px oklch(60% 0.22 250 / 0.45); }
	.cta:active:not(:disabled) { transform: scale(0.98); }
	.cta:disabled { opacity: 0.4; cursor: not-allowed; }
	.cta-arrow {
		display: inline-flex; align-items: center; justify-content: center;
		width: 1.5rem; height: 1.5rem; border-radius: 9999px;
		background-color: rgba(255, 255, 255, 0.18); font-size: 0.85rem;
		transition: transform 200ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.cta:hover:not(:disabled) .cta-arrow { transform: translateX(2px) translateY(-1px); }

	/* Report-gap micro-link on each tool row */
	.gap-link {
		display: inline-flex; align-items: center; gap: 0.25rem;
		border-radius: 9999px; border: 1px solid transparent;
		background-color: transparent; color: var(--gw-color-text-muted);
		font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em;
		padding: 0.1875rem 0.5rem; cursor: pointer; white-space: nowrap;
		opacity: 0; transition: opacity 160ms cubic-bezier(0.32, 0.72, 0, 1),
		            color 160ms cubic-bezier(0.32, 0.72, 0, 1),
		            border-color 160ms cubic-bezier(0.32, 0.72, 0, 1),
		            background-color 160ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.tool-row:hover .gap-link, .gap-link:focus-visible { opacity: 1; }
	.gap-link:hover {
		color: var(--gw-color-primary);
		border-color: var(--gw-color-border-subtle);
		background-color: var(--gw-color-surface-3);
	}

	.tool-row { transition: background-color 140ms cubic-bezier(0.32, 0.72, 0, 1); }
	.tool-row:hover { background-color: var(--gw-color-surface-3); }

	.label-row {
		display: block;
	}
	.label-row > span {
		display: block;
		font-size: 10px; font-weight: 600; text-transform: uppercase;
		letter-spacing: 0.12em; color: var(--gw-color-text-muted);
		margin-bottom: 0.375rem;
	}

	/* Success / error callouts */
	.ok-callout {
		display: inline-flex; align-items: center; gap: 0.375rem; border-radius: 9999px;
		background-color: oklch(96% 0.05 150); border: 1px solid oklch(85% 0.1 150);
		color: oklch(42% 0.16 150); font-size: 10px; font-weight: 600;
		padding: 3px 9px; text-transform: uppercase; letter-spacing: 0.06em;
	}
	.req { color: var(--gw-color-error); }
</style>

<div class="space-y-5">

	<!-- ── Header ──────────────────────────────────────────────────────────── -->
	<header class="entry entry-1 space-y-2">
		<span
			class="inline-flex items-center rounded-full border border-[var(--gw-color-border-subtle)]
				bg-[var(--gw-color-surface-3)] px-[var(--gw-space-3)] py-[3px]
				text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--gw-color-text-muted)]"
		>
			Reference
		</span>
		<div class="flex items-baseline gap-[var(--gw-space-2)]">
			<h1
				class="text-[var(--gw-text-3xl)] font-semibold leading-[var(--gw-leading-tight)]
					tracking-tight text-[var(--gw-color-text)]"
			>
				Help
			</h1>
			<span class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">
				{data.tools.length} tools
			</span>
		</div>
		<p class="max-w-prose text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">
			The full catalog of operations the agent fabric exposes. Filter to find one, or flag a gap
			where the surface falls short.
		</p>
	</header>

	<div class="grid gap-[var(--gw-space-5)] lg:grid-cols-[1fr_22rem]">

		<!-- ── Tool / operation catalog ───────────────────────────────────────── -->
		<section class="entry entry-2 space-y-[var(--gw-space-3)]" aria-label="Operation catalog">
			<div class="search-wrap">
				<svg class="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none"
					stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
					aria-hidden="true">
					<circle cx="11" cy="11" r="7" />
					<line x1="21" y1="21" x2="16.5" y2="16.5" />
				</svg>
				<input
					type="search"
					bind:value={filter}
					placeholder="Filter operations…"
					class="gw-input"
					aria-label="Filter operations"
				/>
			</div>

			<div class="bezel">
				<div class="bezel-core-overflow">
					{#if tools.length > 0}
						<ul class="divide-y divide-[var(--gw-color-border-subtle)]">
							{#each tools as tool (tool.name)}
								<li class="tool-row flex items-start justify-between gap-[var(--gw-space-3)]
										px-[var(--gw-space-5)] py-[var(--gw-space-3)]">
									<div class="min-w-0 space-y-[2px]">
										<code class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-sm)]
											font-medium text-[var(--gw-color-text)]">
											{tool.name}
										</code>
										<p class="text-[var(--gw-text-xs)] leading-[1.5] text-[var(--gw-color-text-muted)]">
											{tool.description}
										</p>
									</div>
									{#if canReport}
										<button
											type="button"
											class="gap-link mt-[2px] flex-shrink-0"
											onclick={() => (gapOperation = tool.name)}
										>
											Report gap
										</button>
									{/if}
								</li>
							{/each}
						</ul>
					{:else}
						<div class="flex flex-col items-center justify-center gap-[var(--gw-space-2)]
								px-[var(--gw-space-6)] py-[var(--gw-space-10)]">
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
								stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
								style="color: var(--gw-color-text-muted); opacity: 0.4" aria-hidden="true">
								<circle cx="11" cy="11" r="7" />
								<line x1="21" y1="21" x2="16.5" y2="16.5" />
							</svg>
							<p class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">
								No operations match.
							</p>
						</div>
					{/if}
				</div>
			</div>
		</section>

		<!-- ── Report-gap form ────────────────────────────────────────────────── -->
		<aside class="entry entry-3 lg:sticky lg:top-[var(--gw-space-5)] lg:self-start" aria-label="Report a gap">
			<div class="bezel">
				<div class="bezel-core space-y-[var(--gw-space-4)] px-[var(--gw-space-5)] py-[var(--gw-space-5)]">

					<div class="flex items-center gap-[var(--gw-space-3)]">
						<div
							class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--gw-radius-lg)]
								border border-[var(--gw-color-border-subtle)] bg-[var(--gw-color-surface-3)]"
							aria-hidden="true"
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
								stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
								style="color: var(--gw-color-text-muted)">
								<path d="M12 9v4" /><path d="M12 17h.01" />
								<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
							</svg>
						</div>
						<div>
							<h2 class="text-[var(--gw-text-base)] font-semibold text-[var(--gw-color-text)]">
								Report a gap
							</h2>
							<p class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
								Flag a missing or broken operation.
							</p>
						</div>
					</div>

					{#if !canReport}
						<p class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
							Requires the
							<code class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-color-text)]">meta.write</code>
							scope.
						</p>
					{:else}
						{#if form?.ok && form.bead}
							<span class="ok-callout">
								<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
									stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
									<polyline points="20 6 9 17 4 12" />
								</svg>
								Filed {form.bead}
							</span>
						{/if}
						{#if form?.error}
							<p class="text-[var(--gw-text-xs)] text-[var(--gw-color-error)]">{form.error}</p>
						{/if}

						<form method="POST" action="?/report" use:enhance={enhancer} class="space-y-[var(--gw-space-4)]">
							<label class="label-row">
								<span>Operation <span class="req">*</span></span>
								<input name="operation" bind:value={gapOperation} required class="gw-input"
									placeholder="domain.action" />
							</label>
							<label class="label-row">
								<span>Notes</span>
								<textarea name="notes" rows="3" class="gw-input gw-textarea"
									placeholder="What's missing and why."></textarea>
							</label>
							<div class="grid grid-cols-2 gap-[var(--gw-space-3)]">
								<label class="label-row">
									<span>Priority</span>
									<input name="priority" type="number" min="0" class="gw-input" placeholder="—" />
								</label>
								<label class="label-row">
									<span>Epic ref</span>
									<input name="external_ref" class="gw-input" placeholder="hq-…" />
								</label>
							</div>
							<label class="label-row">
								<span>Domains</span>
								<input name="domain" class="gw-input" placeholder="comma-separated" />
							</label>
							<label class="label-row">
								<span>Surfaces</span>
								<input name="surface" class="gw-input" placeholder="comma-separated paths" />
							</label>
							<button type="submit" class="cta w-full justify-center" disabled={saving}>
								<span>{saving ? 'Filing…' : 'Report gap'}</span>
								{#if !saving}<span class="cta-arrow" aria-hidden="true">→</span>{/if}
							</button>
						</form>
					{/if}

				</div>
			</div>
		</aside>

	</div>
</div>
