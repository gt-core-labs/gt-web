<script lang="ts">
	import type { IssueRow } from '$lib/api/tracker';

	/**
	 * Epics overview (gtweb-1c27cf): the operator's first dedicated view of the
	 * epics themselves — each module's own status plus a child-progress bar,
	 * grouped off the resolved `child_of` linkage (`parent_id`). Collapsible so
	 * it stays out of the way on the task-dense planning/kanban boards.
	 */
	interface Props {
		epics: IssueRow[];
		/** Task rows carrying the resolved `parent_id` (their epic membership). */
		tasks: IssueRow[];
		/** Open the epic's card drawer (NOT the create modal — AC: view ≠ create). */
		onpick?: (epic: IssueRow) => void;
	}
	let { epics, tasks, onpick }: Props = $props();

	let open = $state(true);

	const STATUS: Record<string, { label: string; cls: string }> = {
		open: { label: 'Open', cls: 'bg-[var(--gw-color-surface-2)] text-[var(--gw-color-text-muted)]' },
		working: { label: 'Working', cls: 'bg-amber-500/15 text-amber-500' },
		closed: { label: 'Closed', cls: 'bg-emerald-500/15 text-emerald-500' }
	};

	interface EpicStat {
		epic: IssueRow;
		total: number;
		done: number;
		pct: number;
	}
	const stats = $derived.by<EpicStat[]>(() =>
		[...epics]
			.sort((a, b) => a.title.localeCompare(b.title))
			.map((epic) => {
				const children = tasks.filter((t) => t.parent_id === epic.id);
				const done = children.filter((t) => t.status === 'closed').length;
				const total = children.length;
				return { epic, total, done, pct: total ? Math.round((done / total) * 100) : 0 };
			})
	);
</script>

{#if epics.length}
	<section class="rounded-xl border border-[var(--gw-color-border)]">
		<button
			class="flex w-full items-center gap-2 rounded-t-xl border-b border-[var(--gw-color-border)] bg-[var(--gw-color-surface-2)] px-3 py-2 text-left {open ? '' : 'rounded-b-xl border-b-0'}"
			onclick={() => (open = !open)}
			aria-expanded={open}
		>
			<span class="text-xs text-[var(--gw-color-text-muted)]">{open ? '▾' : '▸'}</span>
			<h2 class="text-sm font-semibold">Epics</h2>
			<span class="rounded bg-[var(--gw-color-primary)]/15 px-2 py-0.5 text-[11px] font-semibold text-[var(--gw-color-primary)]">{epics.length}</span>
		</button>

		{#if open}
			<ul class="divide-y divide-[var(--gw-color-border)]">
				{#each stats as { epic, total, done, pct } (epic.id)}
					<li class="flex items-center gap-3 px-3 py-2">
						<span class="shrink-0 rounded px-2 py-0.5 text-[11px] {STATUS[epic.status]?.cls ?? ''}">
							{STATUS[epic.status]?.label ?? epic.status}
						</span>
						<button
							class="min-w-0 flex-1 truncate text-left text-sm hover:text-[var(--gw-color-primary)] hover:underline"
							title={epic.id}
							onclick={() => onpick?.(epic)}
						>{epic.title}</button>
						<span class="hidden shrink-0 font-mono text-[11px] text-[var(--gw-color-text-muted)] sm:inline">{epic.id}</span>
						<div class="hidden h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-[var(--gw-color-surface-2)] sm:block">
							<div class="h-full rounded-full bg-emerald-500" style:width="{pct}%"></div>
						</div>
						<span class="shrink-0 text-[11px] tabular-nums text-[var(--gw-color-text-muted)]">{done}/{total}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}
