<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { Slice } from '$lib/api/analytics';
	import EChart from '$lib/components/EChart.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const s = $derived(data.summary);

	function setParam(key: string, value: string) {
		const url = new URL(page.url);
		if (value) url.searchParams.set(key, value);
		else url.searchParams.delete(key);
		goto(url, { replaceState: true, invalidateAll: true });
	}

	// ── interactive charts via the shared EChart wrapper (gtweb-c70694) ──────
	const AXIS_LABEL = { fontSize: 9, color: '#71717a' };
	const LEGEND = {
		top: 0,
		icon: 'circle',
		itemWidth: 8,
		itemHeight: 8,
		textStyle: { fontSize: 10, color: '#71717a' },
	};
	const TOOLTIP = {
		trigger: 'axis' as const,
		axisPointer: { type: 'shadow' as const },
		textStyle: { fontSize: 11 },
	};

	// Burndown: daily created/closed bars on the left axis, remaining scope line on the
	// right one (different magnitudes — gallery: mix-line-bar).
	const burndownChart = $derived.by(() => {
		const pts = s.series;
		if (pts.length === 0) return null;
		return {
			animationDuration: 300,
			grid: { left: 8, right: 8, top: 30, bottom: 8, containLabel: true },
			legend: LEGEND,
			tooltip: TOOLTIP,
			dataZoom: [{ type: 'inside' as const }],
			xAxis: { type: 'category' as const, data: pts.map((p) => p.date), axisLabel: AXIS_LABEL },
			yAxis: [
				{ type: 'value' as const, axisLabel: AXIS_LABEL, splitLine: { lineStyle: { color: '#e4e4e7' } } },
				{ type: 'value' as const, axisLabel: AXIS_LABEL, splitLine: { show: false } },
			],
			series: [
				{ name: 'Created', type: 'bar' as const, color: 'oklch(60% 0.22 250)', emphasis: { focus: 'series' as const }, data: pts.map((p) => p.created) },
				{ name: 'Resolved', type: 'bar' as const, color: 'oklch(62% 0.20 160)', emphasis: { focus: 'series' as const }, data: pts.map((p) => p.closed) },
				{ name: 'Remaining', type: 'line' as const, yAxisIndex: 1, smooth: 0.2, symbolSize: 4, color: '#f59e0b', data: pts.map((p) => p.remaining) },
			],
		};
	});

	/** Horizontal bar option for a top-6 slice group (distribution mini-charts). */
	const sliceOption = (slices: Slice[]) => {
		const rows = slices.slice(0, 6).reverse(); // reversed: biggest on the top row
		return {
			animationDuration: 300,
			grid: { left: 4, right: 28, top: 4, bottom: 4, containLabel: true },
			tooltip: TOOLTIP,
			xAxis: { type: 'value' as const, axisLabel: { show: false }, splitLine: { show: false } },
			yAxis: {
				type: 'category' as const,
				data: rows.map((r) => r.key || '—'),
				axisLabel: { ...AXIS_LABEL, width: 90, overflow: 'truncate' as const },
			},
			series: [
				{
					type: 'bar' as const,
					color: 'oklch(60% 0.22 250)',
					barWidth: 10,
					data: rows.map((r) => r.count),
					label: { show: true, position: 'right' as const, fontSize: 9, color: '#71717a' },
				},
			],
		};
	};
	const sliceHeight = (slices: Slice[]) => Math.max(60, Math.min(slices.length, 6) * 24 + 12);

	// Progress by module — gallery pick: bar-animation-delay (gtweb-6fc29f). Total and
	// Closed bars side by side per module, each bar entering with a staggered elastic
	// animation; updates (filter changes) re-stagger via animationDelayUpdate.
	const moduleChart = $derived.by(() => {
		const mods = s.avance.by_module;
		if (mods.length === 0) return null;
		const rows = [...mods].sort((a, b) => b.total - a.total);
		const option = {
			animationEasing: 'elasticOut' as const,
			animationDelayUpdate: (idx: number) => idx * 5,
			grid: { left: 8, right: 8, top: 30, bottom: 4, containLabel: true },
			legend: LEGEND,
			tooltip: TOOLTIP,
			xAxis: {
				type: 'category' as const,
				data: rows.map((m) => m.module || 'No module'),
				axisLabel: { ...AXIS_LABEL, rotate: rows.length > 6 ? 30 : 0, overflow: 'truncate' as const, width: 90 },
			},
			yAxis: { type: 'value' as const, axisLabel: AXIS_LABEL, splitLine: { lineStyle: { color: '#e4e4e7' } } },
			series: [
				{
					name: 'Total',
					type: 'bar' as const,
					color: 'oklch(70% 0.03 270)',
					emphasis: { focus: 'series' as const },
					label: { show: true, position: 'top' as const, fontSize: 9, color: '#71717a' },
					data: rows.map((m) => m.total),
					animationDelay: (idx: number) => idx * 100,
				},
				{
					name: 'Closed',
					type: 'bar' as const,
					color: 'oklch(62% 0.20 160)',
					emphasis: { focus: 'series' as const },
					label: { show: true, position: 'top' as const, fontSize: 9, color: '#71717a' },
					data: rows.map((m) => m.closed),
					animationDelay: (idx: number) => idx * 100 + 100,
				},
			],
		};
		return { option, height: 220 };
	});
</script>

<svelte:head><title>Analytics · gt</title></svelte:head>

<div class="space-y-4 p-4">
	<header class="flex flex-wrap items-center gap-3">
		<div class="min-w-0 flex-1">
			<h1 class="text-lg font-semibold">Analytics · {data.rig}</h1>
			<p class="text-xs text-[var(--gw-color-text-muted)]">
				Same numbers as the board and the report (single projection) · today {s.today}
			</p>
		</div>
		<label class="text-xs">
			Series
			<select
				class="ml-1 rounded border border-[var(--gw-color-border)] bg-transparent px-2 py-1 text-sm"
				value={String(data.days)}
				onchange={(e) => setParam('days', (e.currentTarget as HTMLSelectElement).value)}
			>
				<option value="14">14 days</option>
				<option value="30">30 days</option>
				<option value="90">90 days</option>
			</select>
		</label>
		<label class="text-xs">
			Risk
			<select
				class="ml-1 rounded border border-[var(--gw-color-border)] bg-transparent px-2 py-1 text-sm"
				value={String(data.risk)}
				onchange={(e) => setParam('risk', (e.currentTarget as HTMLSelectElement).value)}
			>
				<option value="3">3 days</option>
				<option value="7">7 days</option>
				<option value="14">14 days</option>
			</select>
		</label>
	</header>

	<!-- ── the four headline KPIs ─────────────────────────────────────────── -->
	<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
		<div class="rounded-xl border border-[var(--gw-color-border)] p-3">
			<p class="text-xs uppercase text-[var(--gw-color-text-muted)]">Progress</p>
			<p class="text-2xl font-semibold">{s.avance.pct.toFixed(0)}%</p>
			<p class="text-xs text-[var(--gw-color-text-muted)]">{s.avance.closed}/{s.avance.total} closed</p>
		</div>
		<div class="rounded-xl border border-[var(--gw-color-border)] p-3">
			<p class="text-xs uppercase text-[var(--gw-color-text-muted)]">Errors</p>
			<p class="text-2xl font-semibold">{s.errores.total}</p>
			<p class="text-xs text-[var(--gw-color-text-muted)]">{s.errores.defects} defects · {s.errores.reopens} reopens</p>
		</div>
		<div class="rounded-xl border border-[var(--gw-color-border)] p-3">
			<p class="text-xs uppercase text-[var(--gw-color-text-muted)]">Pending</p>
			<p class="text-2xl font-semibold">{s.pendientes.total}</p>
			<p class="text-xs text-[var(--gw-color-text-muted)]">{s.pendientes.open} open · {s.pendientes.working} in progress</p>
		</div>
		<div class="rounded-xl border border-[var(--gw-color-border)] p-3">
			<p class="text-xs uppercase text-[var(--gw-color-text-muted)]">Overdue</p>
			<p class="text-2xl font-semibold text-[var(--gw-color-danger,#ef4444)]">{s.retrasos.overdue}</p>
			<p class="text-xs text-[var(--gw-color-text-muted)]">{s.retrasos.at_risk} at risk (≤{s.retrasos.at_risk_days}d)</p>
		</div>
	</div>

	<div class="grid gap-3 lg:grid-cols-2">
		<!-- Burndown + created-vs-resolved -->
		<section class="rounded-xl border border-[var(--gw-color-border)] p-3">
			<h2 class="mb-2 text-sm font-semibold">Burndown · created vs resolved ({data.days}d)</h2>
			{#if burndownChart}
				<EChart option={burndownChart} height={190} />
				<p class="mt-1 text-[11px] text-[var(--gw-color-text-muted)]">
					line: remaining scope (right axis) · scroll/drag to zoom · click legend to filter
				</p>
			{:else}
				<p class="text-xs text-[var(--gw-color-text-muted)]">No series.</p>
			{/if}
		</section>

		<!-- Distribution -->
		<section class="rounded-xl border border-[var(--gw-color-border)] p-3">
			<h2 class="mb-2 text-sm font-semibold">Work distribution</h2>
			<div class="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
				{#each [
					{ title: 'By status', slices: s.by_status },
					{ title: 'Pending by assignee', slices: s.pendientes.by_assignee },
					{ title: 'Pending by priority', slices: s.pendientes.by_priority }
				] as group (group.title)}
					<div>
						<p class="mb-1 font-medium text-[var(--gw-color-text-muted)]">{group.title}</p>
						{#if group.slices.length > 0}
							<EChart option={sliceOption(group.slices)} height={sliceHeight(group.slices)} />
						{:else}
							<p class="text-[var(--gw-color-text-muted)]">—</p>
						{/if}
					</div>
				{/each}
			</div>
		</section>

		<!-- Progress by module -->
		<section class="rounded-xl border border-[var(--gw-color-border)] p-3">
			<h2 class="mb-2 text-sm font-semibold">Progress by module</h2>
			{#if moduleChart}
				<EChart option={moduleChart.option} height={moduleChart.height} />
			{:else}
				<p class="text-xs text-[var(--gw-color-text-muted)]">No modules.</p>
			{/if}
		</section>

		<!-- Delays + errors drill-down -->
		<section class="rounded-xl border border-[var(--gw-color-border)] p-3 text-xs">
			<h2 class="mb-2 text-sm font-semibold">Delays and errors</h2>
			<div class="grid grid-cols-2 gap-3">
				<div>
					<p class="mb-1 font-medium text-[var(--gw-color-text-muted)]">Days late</p>
					<ul class="space-y-0.5">
						{#each s.retrasos.days_late as sl (sl.key)}
							<li class="flex justify-between"><span>{sl.key} days</span><span>{sl.count}</span></li>
						{:else}
							<li class="text-[var(--gw-color-text-muted)]">No delays 🎉</li>
						{/each}
					</ul>
					{#if s.retrasos.overdue_ids.length}
						<p class="mt-2 mb-1 font-medium text-[var(--gw-color-text-muted)]">Overdue cards</p>
						<ul class="max-h-32 space-y-0.5 overflow-y-auto font-mono">
							{#each s.retrasos.overdue_ids as id (id)}
								<li><a class="hover:underline" href="/tracker/{id}">{id}</a></li>
							{/each}
						</ul>
					{/if}
				</div>
				<div>
					<p class="mb-1 font-medium text-[var(--gw-color-text-muted)]">Errors by level</p>
					<ul class="space-y-0.5">
						{#each s.errores.by_nivel as sl (sl.key)}
							<li class="flex justify-between"><span>{sl.key}</span><span>{sl.count}</span></li>
						{:else}
							<li class="text-[var(--gw-color-text-muted)]">No defects.</li>
						{/each}
					</ul>
					<p class="mt-2 mb-1 font-medium text-[var(--gw-color-text-muted)]">Errors by module</p>
					<ul class="space-y-0.5 font-mono">
						{#each s.errores.by_module.slice(0, 6) as sl (sl.key)}
							<li class="flex justify-between"><span class="truncate">{sl.key || '—'}</span><span>{sl.count}</span></li>
						{/each}
					</ul>
				</div>
			</div>
		</section>
	</div>
</div>
