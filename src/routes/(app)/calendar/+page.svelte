<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { hasScope } from '$lib/api/auth';
	import { type IssueRow } from '$lib/api/tracker';
	import CardDrawer from '$lib/components/kanban/CardDrawer.svelte';
	import ViewSwitcher from '$lib/components/tracker/ViewSwitcher.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const canWrite = $derived(hasScope(data.user?.scopes, 'issues.write'));
	let selected = $state<IssueRow | null>(null);

	/** `?mode=timeline` flips to the spanning-bars projection (hq-039316). */
	const mode = $derived(page.url.searchParams.get('mode') === 'timeline' ? 'timeline' : 'month');

	// Persist the chosen mode; restore it on a bare /calendar load (hq-039316).
	$effect(() => {
		const param = page.url.searchParams.get('mode');
		try {
			if (param !== null) {
				localStorage.setItem('gt:calendar-mode', mode);
			} else if (localStorage.getItem('gt:calendar-mode') === 'timeline') {
				goto(`/calendar?mode=timeline`, { replaceState: true });
			}
		} catch {
			/* storage unavailable */
		}
	});

	// Month cursor (first day of the displayed month, UTC date-only).
	const now = new Date();
	let cursor = $state(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
	const todayKey = new Date().toISOString().slice(0, 10);

	function shiftMonth(delta: number) {
		cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + delta, 1));
	}

	/** A task lands on its due_date; start_date is the fallback. Epics excluded. */
	const tasks = $derived(data.rows.filter((r) => r.issue_type !== 'epic'));
	const byDay = $derived.by(() => {
		const m = new Map<string, IssueRow[]>();
		for (const t of tasks) {
			const key = t.due_date || t.start_date;
			if (!key) continue;
			m.set(key, [...(m.get(key) ?? []), t]);
		}
		return m;
	});
	const unscheduled = $derived(tasks.filter((t) => !t.due_date && !t.start_date).length);

	interface Cell {
		key: string; // YYYY-MM-DD
		day: number;
		inMonth: boolean;
	}
	// 6 weeks × 7 days, Monday-first — covers any month layout.
	const cells = $derived.by<Cell[]>(() => {
		const first = cursor;
		const lead = (first.getUTCDay() + 6) % 7; // days before the 1st (Mon = 0)
		const start = new Date(first);
		start.setUTCDate(start.getUTCDate() - lead);
		return Array.from({ length: 42 }, (_, i) => {
			const d = new Date(start);
			d.setUTCDate(d.getUTCDate() + i);
			return {
				key: d.toISOString().slice(0, 10),
				day: d.getUTCDate(),
				inMonth: d.getUTCMonth() === first.getUTCMonth()
			};
		});
	});

	// ── timeline mode (hq-039316): bars spanning start_date → due_date ──────
	const DAY_PX = 32;
	/** Window: 12 Monday-first weeks starting the week of the cursor month. */
	const winStart = $derived.by(() => {
		const m = new Date(cursor);
		m.setUTCDate(m.getUTCDate() - ((m.getUTCDay() + 6) % 7));
		return m;
	});
	const WIN_DAYS = 84;
	const winDays = $derived.by(() =>
		Array.from({ length: WIN_DAYS }, (_, i) => {
			const d = new Date(winStart);
			d.setUTCDate(d.getUTCDate() + i);
			return {
				key: d.toISOString().slice(0, 10),
				day: d.getUTCDate(),
				dow: (d.getUTCDay() + 6) % 7, // Mon = 0
				weekend: d.getUTCDay() === 0 || d.getUTCDay() === 6
			};
		})
	);
	/** Week header groups: ISO week number + month label per 7-day block. */
	const winWeeks = $derived.by(() =>
		Array.from({ length: WIN_DAYS / 7 }, (_, i) => {
			const monday = new Date(winStart);
			monday.setUTCDate(monday.getUTCDate() + i * 7);
			const thursday = new Date(monday);
			thursday.setUTCDate(thursday.getUTCDate() + 3);
			const jan1 = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
			const n = Math.ceil(((thursday.getTime() - jan1.getTime()) / 86400000 + 1) / 7);
			return {
				label: monday.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
				week: `Week ${n}`
			};
		})
	);
	const dayIndex = (key: string) =>
		Math.round((new Date(`${key}T00:00:00Z`).getTime() - winStart.getTime()) / 86400000);
	interface Bar {
		task: IssueRow;
		/** 1-based grid column start / end (end exclusive). */
		from: number;
		to: number;
		clippedStart: boolean;
		clippedEnd: boolean;
	}
	const bars = $derived.by<Bar[]>(() => {
		const out: Bar[] = [];
		for (const t of tasks) {
			const sKey = t.start_date || t.due_date;
			const eKey = t.due_date || t.start_date;
			if (!sKey || !eKey) continue;
			let s = dayIndex(sKey);
			let e = dayIndex(eKey);
			if (e < s) [s, e] = [e, s];
			if (e < 0 || s >= WIN_DAYS) continue; // fully outside the window
			out.push({
				task: t,
				from: Math.max(s, 0) + 1,
				to: Math.min(e, WIN_DAYS - 1) + 2,
				clippedStart: s < 0,
				clippedEnd: e > WIN_DAYS - 1
			});
		}
		// Earliest start first, longest first on ties — stable Gantt reading order.
		return out.sort((a, b) => a.from - b.from || b.to - a.to);
	});

	const monthLabel = $derived(
		cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
	);

	const PRIORITY_DOT = ['bg-red-500', 'bg-amber-500', 'bg-slate-400'];
	const PRIORITY_BAR = [
		'bg-red-500/20 border-red-500/60',
		'bg-amber-500/20 border-amber-500/60',
		'bg-[var(--gw-color-primary)]/15 border-[var(--gw-color-primary)]/50'
	];
	const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
</script>

<svelte:head><title>Calendar · gt</title></svelte:head>

<div class="flex h-full flex-col gap-3 p-4">
	<header class="flex flex-wrap items-center gap-3">
		<div class="min-w-0 flex-1">
			<h1 class="text-lg font-semibold">Calendar · {data.rig}</h1>
			<p class="text-xs text-[var(--gw-color-text-muted)]">
				{#if mode === 'timeline'}
					Bars span start → due date — click a bar to open its card.
				{:else}
					Tasks by due date (start date fallback) — click a task to open its card.
				{/if}
				{#if unscheduled > 0}
					<a class="text-[var(--gw-color-primary)] hover:underline" href="{base}/planning">{unscheduled} unscheduled →</a>
				{/if}
			</p>
		</div>

		<div class="flex items-center gap-1 text-sm">
			<button
				class="rounded border border-[var(--gw-color-border)] px-2 py-1 hover:bg-[var(--gw-color-surface-2)]"
				onclick={() => shiftMonth(-1)}
				aria-label="Previous month"
			>←</button>
			<button
				class="rounded border border-[var(--gw-color-border)] px-3 py-1 hover:bg-[var(--gw-color-surface-2)]"
				onclick={() => (cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)))}
			>Today</button>
			<button
				class="rounded border border-[var(--gw-color-border)] px-2 py-1 hover:bg-[var(--gw-color-surface-2)]"
				onclick={() => shiftMonth(1)}
				aria-label="Next month"
			>→</button>
		</div>
		<h2 class="w-44 text-right text-sm font-semibold">{monthLabel}</h2>

		<ViewSwitcher />
	</header>

	{#if mode === 'timeline'}
		<!-- Timeline: 12-week day grid, one row per scheduled task. Fills the
		     page height so the horizontal scrollbar sits at the viewport
		     bottom instead of glued under the last bar. -->
		<div class="min-h-0 flex-1 overflow-auto rounded-xl border border-[var(--gw-color-border)]">
			<div class="min-h-full" style="width: {WIN_DAYS * DAY_PX}px">
				<!-- Week group header -->
				<div class="grid border-b border-[var(--gw-color-border)] bg-[var(--gw-color-surface-2)]" style="grid-template-columns: repeat({WIN_DAYS / 7}, {7 * DAY_PX}px)">
					{#each winWeeks as w, i (i)}
						<div class="flex items-baseline justify-between border-l border-[var(--gw-color-border)] px-2 py-1 first:border-l-0">
							<span class="text-xs font-semibold">{w.label}</span>
							<span class="text-[10px] text-[var(--gw-color-text-muted)]">{w.week}</span>
						</div>
					{/each}
				</div>
				<!-- Day header -->
				<div class="grid border-b border-[var(--gw-color-border)]" style="grid-template-columns: repeat({WIN_DAYS}, {DAY_PX}px)">
					{#each winDays as d (d.key)}
						<div class="border-l border-[var(--gw-color-border)]/50 px-1 py-0.5 text-center text-[10px] {d.key === todayKey ? 'bg-[var(--gw-color-primary)]/15 font-bold text-[var(--gw-color-primary)]' : d.weekend ? 'bg-[var(--gw-color-surface-2)] text-[var(--gw-color-text-muted)]' : 'text-[var(--gw-color-text-muted)]'} first:border-l-0">
							{d.day}
						</div>
					{/each}
				</div>
				<!-- Task rows -->
				{#each bars as b (b.task.id)}
					<div class="relative grid h-10 items-center" style="grid-template-columns: repeat({WIN_DAYS}, {DAY_PX}px)">
						{#each winDays as d (d.key)}
							<div class="h-full border-l border-[var(--gw-color-border)]/30 {d.key === todayKey ? 'bg-[var(--gw-color-primary)]/8' : d.weekend ? 'bg-[var(--gw-color-surface-2)]/60' : ''} first:border-l-0"></div>
						{/each}
						<button
							class="absolute z-10 mx-0.5 flex h-7 min-w-0 items-center gap-1 truncate border px-1.5 text-left text-xs hover:brightness-110 {PRIORITY_BAR[b.task.priority] ?? PRIORITY_BAR[2]} {b.task.status === 'closed' ? 'line-through opacity-50' : ''} {b.clippedStart ? 'rounded-r' : b.clippedEnd ? 'rounded-l' : 'rounded'}"
							style="left: {(b.from - 1) * DAY_PX}px; width: {(b.to - b.from) * DAY_PX - 4}px"
							title="{b.task.id} — {b.task.title} ({b.task.start_date ?? '?'} → {b.task.due_date ?? '?'})"
							onclick={() => (selected = b.task)}
						>
							<span class="h-1.5 w-1.5 shrink-0 rounded-full {PRIORITY_DOT[b.task.priority] ?? PRIORITY_DOT[2]}"></span>
							<span class="truncate">{b.task.title}</span>
						</button>
					</div>
				{:else}
					<p class="p-4 text-sm text-[var(--gw-color-text-muted)]">No scheduled tasks in this window.</p>
				{/each}
			</div>
		</div>
	{:else}
		<!-- Month grid fills the page height: 6 equal week rows under the weekday header. -->
		<div class="grid min-h-0 flex-1 grid-cols-7 grid-rows-[auto_repeat(6,minmax(7rem,1fr))] gap-px overflow-auto rounded-xl border border-[var(--gw-color-border)] bg-[var(--gw-color-border)]">
			{#each WEEKDAYS as d (d)}
				<div class="bg-[var(--gw-color-surface-2)] px-2 py-1 text-[11px] font-semibold uppercase text-[var(--gw-color-text-muted)]">{d}</div>
			{/each}
			{#each cells as cell (cell.key)}
				{@const items = byDay.get(cell.key) ?? []}
				<div class="min-h-0 overflow-y-auto bg-[var(--gw-color-surface)] p-1 {cell.inMonth ? '' : 'opacity-40'}">
					<p class="px-1 text-right text-[11px] {cell.key === todayKey ? 'font-bold text-[var(--gw-color-primary)]' : 'text-[var(--gw-color-text-muted)]'}">
						{cell.day}
					</p>
					<div class="space-y-0.5">
						{#each items as t (t.id)}
							<button
								class="flex w-full items-center gap-1 rounded bg-[var(--gw-color-surface-2)] px-1 py-0.5 text-left text-[11px] hover:bg-[var(--gw-color-primary)]/15 {t.status === 'closed' ? 'line-through opacity-50' : ''}"
								title="{t.id} — {t.title}"
								onclick={() => (selected = t)}
							>
								<span class="h-1.5 w-1.5 shrink-0 rounded-full {PRIORITY_DOT[t.priority] ?? PRIORITY_DOT[2]}"></span>
								<span class="truncate">{t.title}</span>
							</button>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if selected}
	<CardDrawer
		card={selected}
		{canWrite}
		users={data.users}
		me={data.user?.sub ?? ''}
		allIssues={data.rows}
		onClose={() => (selected = null)}
	/>
{/if}
