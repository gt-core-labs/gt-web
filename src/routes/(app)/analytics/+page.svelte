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
				{ name: 'Creadas', type: 'bar' as const, color: 'oklch(60% 0.22 250)', emphasis: { focus: 'series' as const }, data: pts.map((p) => p.created) },
				{ name: 'Resueltas', type: 'bar' as const, color: 'oklch(62% 0.20 160)', emphasis: { focus: 'series' as const }, data: pts.map((p) => p.closed) },
				{ name: 'Restante', type: 'line' as const, yAxisIndex: 1, smooth: 0.2, symbolSize: 4, color: '#f59e0b', data: pts.map((p) => p.remaining) },
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

	// Avance por módulo: stacked closed/open per module, heaviest module on top.
	const moduleChart = $derived.by(() => {
		const mods = s.avance.by_module;
		if (mods.length === 0) return null;
		const rows = [...mods].sort((a, b) => a.total - b.total);
		const option = {
			animationDuration: 300,
			grid: { left: 4, right: 36, top: 30, bottom: 4, containLabel: true },
			legend: LEGEND,
			tooltip: TOOLTIP,
			xAxis: { type: 'value' as const, axisLabel: AXIS_LABEL, splitLine: { lineStyle: { color: '#e4e4e7' } } },
			yAxis: {
				type: 'category' as const,
				data: rows.map((m) => m.module || 'Sin módulo'),
				axisLabel: { ...AXIS_LABEL, width: 120, overflow: 'truncate' as const },
			},
			series: [
				{ name: 'Cerradas', type: 'bar' as const, stack: 't', color: 'oklch(62% 0.20 160)', emphasis: { focus: 'series' as const }, data: rows.map((m) => m.closed) },
				{ name: 'Abiertas', type: 'bar' as const, stack: 't', color: 'oklch(70% 0.03 270)', emphasis: { focus: 'series' as const }, data: rows.map((m) => m.total - m.closed) },
			],
		};
		return { option, height: Math.max(100, rows.length * 26 + 46) };
	});
</script>

<svelte:head><title>Analytics · gt</title></svelte:head>

<div class="space-y-4 p-4">
	<header class="flex flex-wrap items-center gap-3">
		<div class="min-w-0 flex-1">
			<h1 class="text-lg font-semibold">Analytics · {data.rig}</h1>
			<p class="text-xs text-[var(--gw-color-text-muted)]">
				Mismos números que el tablero y el reporte (proyección única) · hoy {s.today}
			</p>
		</div>
		<label class="text-xs">
			Serie
			<select
				class="ml-1 rounded border border-[var(--gw-color-border)] bg-transparent px-2 py-1 text-sm"
				value={String(data.days)}
				onchange={(e) => setParam('days', (e.currentTarget as HTMLSelectElement).value)}
			>
				<option value="14">14 días</option>
				<option value="30">30 días</option>
				<option value="90">90 días</option>
			</select>
		</label>
		<label class="text-xs">
			Riesgo
			<select
				class="ml-1 rounded border border-[var(--gw-color-border)] bg-transparent px-2 py-1 text-sm"
				value={String(data.risk)}
				onchange={(e) => setParam('risk', (e.currentTarget as HTMLSelectElement).value)}
			>
				<option value="3">3 días</option>
				<option value="7">7 días</option>
				<option value="14">14 días</option>
			</select>
		</label>
	</header>

	<!-- ── the four headline KPIs ─────────────────────────────────────────── -->
	<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
		<div class="rounded-xl border border-[var(--gw-color-border)] p-3">
			<p class="text-xs uppercase text-[var(--gw-color-text-muted)]">Avance</p>
			<p class="text-2xl font-semibold">{s.avance.pct.toFixed(0)}%</p>
			<p class="text-xs text-[var(--gw-color-text-muted)]">{s.avance.closed}/{s.avance.total} cerradas</p>
		</div>
		<div class="rounded-xl border border-[var(--gw-color-border)] p-3">
			<p class="text-xs uppercase text-[var(--gw-color-text-muted)]">Errores</p>
			<p class="text-2xl font-semibold">{s.errores.total}</p>
			<p class="text-xs text-[var(--gw-color-text-muted)]">{s.errores.defects} defectos · {s.errores.reopens} reaperturas</p>
		</div>
		<div class="rounded-xl border border-[var(--gw-color-border)] p-3">
			<p class="text-xs uppercase text-[var(--gw-color-text-muted)]">Pendientes</p>
			<p class="text-2xl font-semibold">{s.pendientes.total}</p>
			<p class="text-xs text-[var(--gw-color-text-muted)]">{s.pendientes.open} abiertas · {s.pendientes.working} en curso</p>
		</div>
		<div class="rounded-xl border border-[var(--gw-color-border)] p-3">
			<p class="text-xs uppercase text-[var(--gw-color-text-muted)]">Retrasos</p>
			<p class="text-2xl font-semibold text-[var(--gw-color-danger,#ef4444)]">{s.retrasos.overdue}</p>
			<p class="text-xs text-[var(--gw-color-text-muted)]">{s.retrasos.at_risk} en riesgo (≤{s.retrasos.at_risk_days}d)</p>
		</div>
	</div>

	<div class="grid gap-3 lg:grid-cols-2">
		<!-- Burndown + created-vs-resolved -->
		<section class="rounded-xl border border-[var(--gw-color-border)] p-3">
			<h2 class="mb-2 text-sm font-semibold">Burndown · creadas vs resueltas ({data.days}d)</h2>
			{#if burndownChart}
				<EChart option={burndownChart} height={190} />
				<p class="mt-1 text-[11px] text-[var(--gw-color-text-muted)]">
					línea: alcance restante (eje derecho) · rueda/arrastre para zoom · clic en la leyenda para filtrar
				</p>
			{:else}
				<p class="text-xs text-[var(--gw-color-text-muted)]">Sin serie.</p>
			{/if}
		</section>

		<!-- Distribution -->
		<section class="rounded-xl border border-[var(--gw-color-border)] p-3">
			<h2 class="mb-2 text-sm font-semibold">Distribución de trabajo</h2>
			<div class="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
				{#each [
					{ title: 'Por estado', slices: s.by_status },
					{ title: 'Pendiente por responsable', slices: s.pendientes.by_assignee },
					{ title: 'Pendiente por prioridad', slices: s.pendientes.by_priority }
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

		<!-- Avance por módulo -->
		<section class="rounded-xl border border-[var(--gw-color-border)] p-3">
			<h2 class="mb-2 text-sm font-semibold">Avance por módulo</h2>
			{#if moduleChart}
				<EChart option={moduleChart.option} height={moduleChart.height} />
			{:else}
				<p class="text-xs text-[var(--gw-color-text-muted)]">Sin módulos.</p>
			{/if}
		</section>

		<!-- Retrasos + errores drill-down -->
		<section class="rounded-xl border border-[var(--gw-color-border)] p-3 text-xs">
			<h2 class="mb-2 text-sm font-semibold">Retrasos y errores</h2>
			<div class="grid grid-cols-2 gap-3">
				<div>
					<p class="mb-1 font-medium text-[var(--gw-color-text-muted)]">Días de retraso</p>
					<ul class="space-y-0.5">
						{#each s.retrasos.days_late as sl (sl.key)}
							<li class="flex justify-between"><span>{sl.key} días</span><span>{sl.count}</span></li>
						{:else}
							<li class="text-[var(--gw-color-text-muted)]">Sin retrasos 🎉</li>
						{/each}
					</ul>
					{#if s.retrasos.overdue_ids.length}
						<p class="mt-2 mb-1 font-medium text-[var(--gw-color-text-muted)]">Tarjetas vencidas</p>
						<ul class="max-h-32 space-y-0.5 overflow-y-auto font-mono">
							{#each s.retrasos.overdue_ids as id (id)}
								<li><a class="hover:underline" href="/tracker/{id}">{id}</a></li>
							{/each}
						</ul>
					{/if}
				</div>
				<div>
					<p class="mb-1 font-medium text-[var(--gw-color-text-muted)]">Errores por Nivel</p>
					<ul class="space-y-0.5">
						{#each s.errores.by_nivel as sl (sl.key)}
							<li class="flex justify-between"><span>{sl.key}</span><span>{sl.count}</span></li>
						{:else}
							<li class="text-[var(--gw-color-text-muted)]">Sin defectos.</li>
						{/each}
					</ul>
					<p class="mt-2 mb-1 font-medium text-[var(--gw-color-text-muted)]">Errores por módulo</p>
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
