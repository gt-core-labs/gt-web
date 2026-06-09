<script lang="ts">
	import type { IssueRow } from '$lib/api/tracker';
	import OperatorBadge from './OperatorBadge.svelte';

	interface Props {
		issue: IssueRow;
		draggable?: boolean;
		onpick?: (id: string) => void;
	}

	let { issue, draggable = false, onpick }: Props = $props();

	const prioVar = (p: number) => (p === 0 || p === 1 ? p : 2);

	// Left accent strip colour: P0 error/red, P1 warning/amber, P2 subtle border.
	const prioAccent: Record<number, string> = {
		0: 'var(--gw-color-error)',
		1: 'var(--gw-color-warning)',
		2: 'var(--gw-color-border)'
	};

	function dragstart(e: DragEvent) {
		e.dataTransfer?.setData('text/plain', issue.id);
		onpick?.(issue.id);
	}
</script>

<!--
  Card is a wrapper div (not one big anchor) so OperatorBadge can carry its own
  terminal link without nesting anchors (hq-agent-observability.6). The title
  region is the navigation link.
-->
<div
	class="group relative overflow-hidden rounded-2xl border border-[var(--gw-color-border)]
		bg-[var(--gw-color-surface)]
		transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
		hover:-translate-y-px hover:border-[var(--gw-color-border)] hover:shadow-[0_6px_20px_-6px_rgba(0,0,0,0.12)]"
>
	<!-- Left priority accent strip -->
	<div
		aria-hidden="true"
		class="absolute inset-y-0 left-0 w-[3px] transition-opacity duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:opacity-100 opacity-80"
		style="background-color: {prioAccent[prioVar(issue.priority)]}"
	></div>

	<a
		href={`/tracker/${issue.id}`}
		class="block space-y-2.5 pb-3 pl-5 pr-4 pt-4 no-underline
			focus-visible:outline-none focus-visible:ring-2
			focus-visible:ring-[var(--gw-color-primary-focus)] focus-visible:ring-offset-1"
		{draggable}
		ondragstart={dragstart}
	>
		<!-- Top row: id + priority badge -->
		<div class="flex items-center justify-between gap-2">
			<span class="truncate font-mono text-[10px] text-[var(--gw-color-text-muted)]">{issue.id}</span>
			<span
				class="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
				style="background-color: var(--gw-prio-{prioVar(issue.priority)}-bg); color: var(--gw-prio-{prioVar(issue.priority)}-fg)"
			>P{issue.priority}</span>
		</div>

		<!-- Title -->
		<p class="text-sm leading-snug text-[var(--gw-color-text)]">{issue.title}</p>

		<!-- Meta row -->
		<div class="flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--gw-color-text-muted)]">
			<span>{issue.issue_type}</span>
			{#if issue.assignee}
				<span aria-hidden="true" class="opacity-30">·</span>
				<span>@{issue.assignee}</span>
			{/if}
			{#if issue.phase}
				<span aria-hidden="true" class="opacity-30">·</span>
				<span class="rounded-full border border-[var(--gw-color-border)] px-1.5 py-px">{issue.phase}</span>
			{/if}
		</div>
	</a>

	{#if issue.operated_by}
		<div class="border-t border-[var(--gw-color-border)]/60 pb-3 pl-5 pr-4 pt-2.5">
			<OperatorBadge operator={issue.operated_by} compact />
		</div>
	{/if}
</div>
