<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { Slice } from '$lib/api/analytics';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const s = $derived(data.summary);

	function setParam(key: string, value: string) {
		const url = new URL(page.url);
		if (value) url.searchParams.set(key, value);
		else url.searchParams.delete(key);
		goto(url, { replaceState: true, invalidateAll: true });
	}

	// ── chart geometry (hand-rolled SVG; no chart dependency) ────────────────
	const W = 560;
	const H = 140;
	const PAD = 6;

	const maxRemaining = $derived(Math.max(1, ...s.series.map((p) => p.remaining)));
	const maxDaily = $derived(Math.max(1, ...s.series.map((p) => Math.max(p.created, p.closed))));

	const x = (i: number) =>
		PAD + (i * (W - 2 * PAD)) / Math.max(1, s.series.length - 1);
	const yBurn = (v: number) => H - PAD - (v * (H - 2 * PAD)) / maxRemaining;

	const burndownPath = $derived(
		s.series.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${yBurn(p.remaining).toFixed(1)}`).join(' ')
	);

	const barW = $derived(Math.max(2, (W - 2 * PAD) / Math.max(1, s.series.length) / 2 - 1));

	function pct(part: number, whole: number): number {
		return whole === 0 ? 0 : Math.round((part / whole) * 100);
	}

	const maxSlice = (slices: Slice[]) => Math.max(1, ...slices.map((x) => x.count));
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
			<svg viewBox="0 0 {W} {H}" class="w-full" role="img" aria-label="Burndown chart">
				{#each s.series as p, i (p.date)}
					{#if p.created > 0}
						<rect
							x={x(i) - barW - 0.5}
							y={H - PAD - (p.created * (H - 2 * PAD)) / maxDaily}
							width={barW}
							height={(p.created * (H - 2 * PAD)) / maxDaily}
							fill="var(--gw-color-primary)"
							opacity="0.55"
						><title>{p.date}: {p.created} creadas</title></rect>
					{/if}
					{#if p.closed > 0}
						<rect
							x={x(i) + 0.5}
							y={H - PAD - (p.closed * (H - 2 * PAD)) / maxDaily}
							width={barW}
							height={(p.closed * (H - 2 * PAD)) / maxDaily}
							fill="var(--gw-color-success,#22c55e)"
							opacity="0.7"
						><title>{p.date}: {p.closed} resueltas</title></rect>
					{/if}
				{/each}
				<path d={burndownPath} fill="none" stroke="var(--gw-color-warning,#f59e0b)" stroke-width="2" />
			</svg>
			<p class="mt-1 text-[11px] text-[var(--gw-color-text-muted)]">
				barras: creadas (azul) / resueltas (verde) · línea: alcance restante
			</p>
		</section>

		<!-- Distribution -->
		<section class="rounded-xl border border-[var(--gw-color-border)] p-3">
			<h2 class="mb-2 text-sm font-semibold">Distribución de trabajo</h2>
			<div class="grid grid-cols-3 gap-3 text-xs">
				{#each [
					{ title: 'Por estado', slices: s.by_status },
					{ title: 'Pendiente por responsable', slices: s.pendientes.by_assignee },
					{ title: 'Pendiente por prioridad', slices: s.pendientes.by_priority }
				] as group (group.title)}
					<div>
						<p class="mb-1 font-medium text-[var(--gw-color-text-muted)]">{group.title}</p>
						<ul class="space-y-1">
							{#each group.slices.slice(0, 6) as sl (sl.key)}
								<li>
									<span class="flex justify-between">
										<span class="truncate">{sl.key || '—'}</span><span>{sl.count}</span>
									</span>
									<span class="block h-1 rounded bg-[var(--gw-color-surface-2)]">
										<span
											class="block h-1 rounded bg-[var(--gw-color-primary)]"
											style:width="{pct(sl.count, maxSlice(group.slices))}%"
										></span>
									</span>
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			</div>
		</section>

		<!-- Avance por módulo -->
		<section class="rounded-xl border border-[var(--gw-color-border)] p-3">
			<h2 class="mb-2 text-sm font-semibold">Avance por módulo</h2>
			<ul class="space-y-2 text-xs">
				{#each s.avance.by_module as m (m.module)}
					<li>
						<span class="flex justify-between">
							<span class="truncate font-mono">{m.module || 'Sin módulo'}</span>
							<span>{m.closed}/{m.total}</span>
						</span>
						<span class="block h-1.5 rounded bg-[var(--gw-color-surface-2)]">
							<span
								class="block h-1.5 rounded bg-[var(--gw-color-success,#22c55e)]"
								style:width="{pct(m.closed, m.total)}%"
							></span>
						</span>
					</li>
				{:else}
					<li class="text-[var(--gw-color-text-muted)]">Sin módulos.</li>
				{/each}
			</ul>
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
