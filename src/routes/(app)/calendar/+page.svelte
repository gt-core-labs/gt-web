<script lang="ts">
	import { hasScope } from '$lib/api/auth';
	import { type IssueRow } from '$lib/api/tracker';
	import CardDrawer from '$lib/components/kanban/CardDrawer.svelte';
	import { Icon } from '$lib/ui';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const canWrite = $derived(hasScope(data.user?.scopes, 'issues.write'));
	let selected = $state<IssueRow | null>(null);

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

	const monthLabel = $derived(
		cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
	);

	const PRIORITY_DOT = ['bg-red-500', 'bg-amber-500', 'bg-slate-400'];
	const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
</script>

<svelte:head><title>Calendar · gt</title></svelte:head>

<div class="flex h-full flex-col gap-3 p-4">
	<header class="flex flex-wrap items-center gap-3">
		<div class="min-w-0 flex-1">
			<h1 class="text-lg font-semibold">Calendar · {data.rig}</h1>
			<p class="text-xs text-[var(--gw-color-text-muted)]">
				Tasks by due date (start date fallback) — click a task to open its card.
				{#if unscheduled > 0}
					<a class="text-[var(--gw-color-primary)] hover:underline" href="/planning">{unscheduled} unscheduled →</a>
				{/if}
			</p>
		</div>

		<a
			class="rounded border border-[var(--gw-color-border)] p-1.5 hover:bg-[var(--gw-color-surface-2)]"
			href="/planning"
			title="Planning view"
			aria-label="Switch to planning view"
		><Icon icon="lucide:calendar-range" size={16} /></a>

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
	</header>

	<div class="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-[var(--gw-color-border)] bg-[var(--gw-color-border)]">
		{#each WEEKDAYS as d (d)}
			<div class="bg-[var(--gw-color-surface-2)] px-2 py-1 text-[11px] font-semibold uppercase text-[var(--gw-color-text-muted)]">{d}</div>
		{/each}
		{#each cells as cell (cell.key)}
			{@const items = byDay.get(cell.key) ?? []}
			<div class="min-h-24 bg-[var(--gw-color-surface)] p-1 {cell.inMonth ? '' : 'opacity-40'}">
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
</div>

{#if selected}
	<CardDrawer
		card={selected}
		{canWrite}
		users={data.users}
		allIssues={data.rows}
		onClose={() => (selected = null)}
	/>
{/if}
