<script lang="ts">
	import type { StatBucket } from '$lib/api/stats';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const current = $derived(data.user?.workspace ?? '');

	function pct(b: StatBucket) {
		return Math.round(b.progress_pct);
	}
	function bucketLabel(b: StatBucket) {
		const vals = Object.values(b.key);
		return vals.length ? vals.join(' / ') : '—';
	}
	function hms(secs?: number) {
		if (secs == null) return '—';
		const h = Math.floor(secs / 3600);
		const m = Math.round((secs % 3600) / 60);
		return h > 0 ? `${h}h ${m}m` : `${m}m`;
	}
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
	.entry-4 { animation-delay: 180ms; }

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

	/* Progress arc via conic-gradient */
	.progress-arc {
		border-radius: 9999px;
	}
	.progress-arc-inner {
		border-radius: 9999px;
		background-color: var(--gw-color-surface);
	}

	/* Bento stat chips */
	.stat-chip {
		border-radius: var(--gw-radius-xl);
		border: 1px solid var(--gw-color-border-subtle);
		background-color: var(--gw-color-surface-3);
		padding: var(--gw-space-3) var(--gw-space-4);
		transition: transform 220ms cubic-bezier(0.32, 0.72, 0, 1),
		            box-shadow 220ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.stat-chip:hover {
		transform: translateY(-1px);
		box-shadow: 0 8px 20px -4px rgba(0, 0, 0, 0.07);
	}

	/* Table rows */
	.data-row {
		transition: background-color 150ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.data-row:hover {
		background-color: var(--gw-color-surface-3);
	}

	/* Progress bar track */
	.bar-track {
		height: 4px;
		border-radius: 9999px;
		background-color: var(--gw-color-surface-3);
		overflow: hidden;
		flex: 1;
	}
	.bar-fill {
		height: 100%;
		border-radius: 9999px;
		background-color: var(--gw-color-primary);
		transition: width 600ms cubic-bezier(0.32, 0.72, 0, 1);
	}

	/* Workspace select — minimal inline styling */
	.ws-select {
		appearance: none;
		background-color: var(--gw-color-surface-3);
		border: 1px solid var(--gw-color-border-subtle);
		border-radius: var(--gw-radius-full);
		color: var(--gw-color-text);
		font-size: var(--gw-text-xs);
		padding: 3px var(--gw-space-3);
		cursor: pointer;
		transition: border-color 150ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.ws-select:hover {
		border-color: var(--gw-color-primary);
	}
	.ws-select:focus {
		outline: none;
		border-color: var(--gw-color-primary);
	}
</style>

<div class="space-y-5">

	<!-- ── Header ─────────────────────────────────────────────────────────── -->
	<header class="entry entry-1 space-y-2">
		<div class="flex items-center justify-between gap-4">
			<span
				class="inline-flex items-center rounded-full border border-[var(--gw-color-border-subtle)]
					bg-[var(--gw-color-surface-3)] px-[var(--gw-space-3)] py-[3px]
					text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--gw-color-text-muted)]"
			>
				Analytics
			</span>

			{#if data.workspaces.length > 1}
				<form method="POST" action="?/switch" class="flex items-center gap-2">
					<span class="text-[10px] uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">workspace</span>
					<select
						name="workspace"
						class="ws-select"
						onchange={(e) => e.currentTarget.form?.requestSubmit()}
					>
						{#each data.workspaces as w (w.workspace)}
							<option value={w.workspace} selected={w.workspace === current}>
								{w.workspace} ({w.role})
							</option>
						{/each}
					</select>
					<noscript>
						<button
							class="rounded-full border border-[var(--gw-color-border-subtle)]
								bg-[var(--gw-color-surface-3)] px-[var(--gw-space-3)] py-[3px]
								text-[10px] text-[var(--gw-color-text)] transition-colors
								hover:border-[var(--gw-color-primary)]"
							type="submit"
						>Switch</button>
					</noscript>
				</form>
			{/if}
		</div>
		<h1
			class="text-[var(--gw-text-3xl)] font-semibold leading-[var(--gw-leading-tight)]
				tracking-tight text-[var(--gw-color-text)]"
		>
			Statistics
		</h1>
	</header>

	{#if data.error}
		<p class="text-[var(--gw-text-sm)] text-[var(--gw-color-error)]">{data.error}</p>
	{/if}

	{#if data.stats}
		{@const t = data.stats.totals}
		{@const p = pct(t)}

		<!-- ── Totals bento ──────────────────────────────────────────────────── -->
		<div class="entry entry-2 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr] md:grid-cols-[auto_1fr_1fr_1fr]">

			<!-- Progress arc card -->
			<div class="bezel sm:col-span-1 md:col-span-1">
				<div class="bezel-core flex flex-col items-center justify-center gap-3 px-[var(--gw-space-6)] py-[var(--gw-space-5)]">
					<!-- Conic-gradient donut -->
					<div
						class="progress-arc flex h-20 w-20 items-center justify-center"
						style="background: conic-gradient(var(--gw-color-primary) {p}%, var(--gw-color-surface-3) 0)"
					>
						<div class="progress-arc-inner flex h-14 w-14 flex-col items-center justify-center">
							<span class="text-xl font-semibold leading-none text-[var(--gw-color-text)]">{p}%</span>
						</div>
					</div>
					<div class="text-center">
						<p class="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">
							Progress
						</p>
						<p class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
							{t.closed} / {t.total} closed
						</p>
					</div>
				</div>
			</div>

			<!-- Open -->
			<div class="stat-chip flex flex-col justify-between gap-2">
				<span class="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--gw-color-text-muted)]">
					Open
				</span>
				<span class="text-[var(--gw-text-3xl)] font-semibold leading-none text-[var(--gw-color-text)]">
					{t.open}
				</span>
				<div class="bar-track">
					<div class="bar-fill" style="width: {t.total ? Math.round(t.open / t.total * 100) : 0}%"></div>
				</div>
			</div>

			<!-- Working -->
			<div class="stat-chip flex flex-col justify-between gap-2">
				<span class="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--gw-color-text-muted)]">
					Working
				</span>
				<span class="text-[var(--gw-text-3xl)] font-semibold leading-none text-[var(--gw-color-warning)]">
					{t.working}
				</span>
				<div class="bar-track" style="background-color: color-mix(in oklab, var(--gw-color-warning) 15%, transparent)">
					<div class="bar-fill" style="width: {t.total ? Math.round(t.working / t.total * 100) : 0}%; background-color: var(--gw-color-warning)"></div>
				</div>
			</div>

			<!-- Closed -->
			<div class="stat-chip flex flex-col justify-between gap-2">
				<span class="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--gw-color-text-muted)]">
					Closed
				</span>
				<span class="text-[var(--gw-text-3xl)] font-semibold leading-none text-[var(--gw-color-success)]">
					{t.closed}
				</span>
				<div class="bar-track" style="background-color: color-mix(in oklab, var(--gw-color-success) 15%, transparent)">
					<div class="bar-fill" style="width: {p}%; background-color: var(--gw-color-success)"></div>
				</div>
			</div>
		</div>

		<!-- Lead-time strip -->
		<div class="entry entry-2 bezel">
			<div class="bezel-core flex flex-wrap items-center gap-x-6 gap-y-2 px-[var(--gw-space-5)] py-[var(--gw-space-3)]">
				<span class="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--gw-color-text-muted)]">
					Lead time
				</span>
				<div class="flex items-baseline gap-1">
					<span class="text-[var(--gw-text-sm)] font-semibold text-[var(--gw-color-text)]">{hms(t.lead_time.mean_secs)}</span>
					<span class="text-[10px] text-[var(--gw-color-text-muted)]">mean</span>
				</div>
				<div class="flex items-baseline gap-1">
					<span class="text-[var(--gw-text-sm)] font-semibold text-[var(--gw-color-text)]">{hms(t.lead_time.median_secs)}</span>
					<span class="text-[10px] text-[var(--gw-color-text-muted)]">median</span>
				</div>
				{#if t.lead_time.min_secs != null}
					<div class="flex items-baseline gap-1">
						<span class="text-[var(--gw-text-sm)] font-semibold text-[var(--gw-color-text)]">{hms(t.lead_time.min_secs)}</span>
						<span class="text-[10px] text-[var(--gw-color-text-muted)]">min</span>
					</div>
				{/if}
				{#if t.lead_time.max_secs != null}
					<div class="flex items-baseline gap-1">
						<span class="text-[var(--gw-text-sm)] font-semibold text-[var(--gw-color-text)]">{hms(t.lead_time.max_secs)}</span>
						<span class="text-[10px] text-[var(--gw-color-text-muted)]">max</span>
					</div>
				{/if}
				<span class="ml-auto text-[10px] text-[var(--gw-color-text-muted)]">
					{t.lead_time.count} sample{t.lead_time.count !== 1 ? 's' : ''}
				</span>
			</div>
		</div>

		<!-- ── Group-by segmented control ─────────────────────────────────────── -->
		<nav
			class="entry entry-3 grid gap-[3px] rounded-[var(--gw-radius-xl)]
				bg-[var(--gw-color-surface-3)] p-[3px] ring-1 ring-[var(--gw-color-border-subtle)]"
			style="grid-template-columns: repeat({data.groups.length}, minmax(0, 1fr))"
			aria-label="Group by"
		>
			{#each data.groups as g (g)}
				{@const active = g === data.groupBy}
				<a
					href={`?group_by=${g}`}
					aria-current={active ? 'page' : undefined}
					class="rounded-[calc(var(--gw-radius-xl)-3px)] py-[var(--gw-space-2)]
						text-center text-[var(--gw-text-xs)] font-medium
						transition-all duration-[200ms] ease-[cubic-bezier(0.32,0.72,0,1)]
						focus-visible:outline-none focus-visible:ring-2
						focus-visible:ring-[var(--gw-color-primary-focus)]
						{active
							? 'bg-[var(--gw-color-primary)] text-white shadow-sm'
							: 'text-[var(--gw-color-text-muted)] hover:text-[var(--gw-color-text)]'}"
				>
					{g}
				</a>
			{/each}
		</nav>

		<!-- ── Breakdown table ────────────────────────────────────────────────── -->
		<div class="entry entry-4 bezel">
			<div class="bezel-core-overflow">
				<table class="w-full text-left">
					<thead>
						<tr class="border-b border-[var(--gw-color-border-subtle)]">
							<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">
								{data.groupBy}
							</th>
							<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">
								Progress
							</th>
							<th class="px-[var(--gw-space-3)] py-[var(--gw-space-3)] text-right text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">
								Open
							</th>
							<th class="px-[var(--gw-space-3)] py-[var(--gw-space-3)] text-right text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">
								Working
							</th>
							<th class="px-[var(--gw-space-3)] py-[var(--gw-space-3)] text-right text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">
								Closed
							</th>
							<th class="px-[var(--gw-space-3)] py-[var(--gw-space-3)] text-right text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">
								Total
							</th>
							<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-right text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">
								Lead (mean)
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-[var(--gw-color-border-subtle)]">
						{#each data.stats.buckets as b (bucketLabel(b))}
							{@const bp = pct(b)}
							<tr class="data-row">
								<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
									<span class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)]
										font-medium text-[var(--gw-color-text)]">
										{bucketLabel(b)}
									</span>
								</td>
								<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
									<div class="flex min-w-[120px] items-center gap-[var(--gw-space-2)]">
										<div class="bar-track">
											<div class="bar-fill" style="width: {bp}%"></div>
										</div>
										<span class="w-8 shrink-0 text-right font-[family-name:var(--gw-font-mono)]
											text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
											{bp}%
										</span>
									</div>
								</td>
								<td class="px-[var(--gw-space-3)] py-[var(--gw-space-3)] text-right
									font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)]
									text-[var(--gw-color-text-muted)]">
									{b.open}
								</td>
								<td class="px-[var(--gw-space-3)] py-[var(--gw-space-3)] text-right
									font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)]
									text-[var(--gw-color-warning)]">
									{b.working}
								</td>
								<td class="px-[var(--gw-space-3)] py-[var(--gw-space-3)] text-right
									font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)]
									text-[var(--gw-color-success)]">
									{b.closed}
								</td>
								<td class="px-[var(--gw-space-3)] py-[var(--gw-space-3)] text-right
									font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)]
									font-semibold text-[var(--gw-color-text)]">
									{b.total}
								</td>
								<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-right
									font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)]
									text-[var(--gw-color-text-muted)]">
									{hms(b.lead_time.mean_secs)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

	{:else if !data.error}
		<p class="entry entry-2 text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">
			No statistics available.
		</p>
	{/if}

</div>
