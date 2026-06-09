<script lang="ts">
	import { Badge } from '$lib/ui';
	import type { IssueRow } from '$lib/api/tracker';
	import OperatorBadge from './OperatorBadge.svelte';

	interface Props {
		issue: IssueRow;
		draggable?: boolean;
		onpick?: (id: string) => void;
	}

	let { issue, draggable = false, onpick }: Props = $props();

	const prio: Record<number, 'error' | 'warning' | 'surface'> = {
		0: 'error',
		1: 'warning',
		2: 'surface'
	};

	// Left accent dot colour mirrors the priority badge tone.
	const prioDot: Record<number, string> = {
		0: 'var(--gw-color-error)',
		1: 'var(--gw-color-warning)',
		2: 'var(--gw-color-border)'
	};

	function dragstart(e: DragEvent) {
		e.dataTransfer?.setData('text/plain', issue.id);
		onpick?.(issue.id);
	}
</script>

<!-- The card is a wrapper div (not one big anchor) so the operator badge can carry its own
	terminal link without nesting anchors (hq-agent-observability.6). The title region stays the
	link to the bead detail. -->
<div
	class="group rounded-[var(--gw-radius-lg)] border border-[var(--gw-color-border-subtle)]
		bg-[var(--gw-color-surface)] p-[var(--gw-space-3)]
		shadow-[var(--gw-shadow-sm)]
		transition-[box-shadow,border-color,transform] duration-[var(--gw-duration-fast)]
		hover:-translate-y-px hover:border-[var(--gw-color-primary-focus)] hover:shadow-[var(--gw-shadow-md)]"
>
	<a
		href={`/tracker/${issue.id}`}
		class="block space-y-[var(--gw-space-2)] no-underline
			focus-visible:outline-none focus-visible:ring-2
			focus-visible:ring-[var(--gw-color-primary-focus)] focus-visible:ring-offset-1"
		{draggable}
		ondragstart={dragstart}
	>
		<div class="flex items-center justify-between gap-[var(--gw-space-2)]">
			<span class="flex items-center gap-[var(--gw-space-2)] min-w-0">
				<span
					aria-hidden="true"
					class="h-2 w-2 shrink-0 rounded-[var(--gw-radius-full)]"
					style="background-color: {prioDot[issue.priority] ?? 'var(--gw-color-border)'}"
				></span>
				<span class="truncate font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
					{issue.id}
				</span>
			</span>
			<Badge variant={prio[issue.priority] ?? 'surface'}>P{issue.priority}</Badge>
		</div>
		<p
			class="text-[var(--gw-text-sm)] leading-[var(--gw-leading-snug)] text-[var(--gw-color-text)]
				transition-colors duration-[var(--gw-duration-fast)] group-hover:text-[var(--gw-color-primary)]"
		>
			{issue.title}
		</p>
		<div class="flex flex-wrap items-center gap-[var(--gw-space-2)] text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
			<span>{issue.issue_type}</span>
			{#if issue.assignee}
				<span aria-hidden="true" class="opacity-40">·</span>
				<span>@{issue.assignee}</span>
			{/if}
			{#if issue.phase}
				<span aria-hidden="true" class="opacity-40">·</span>
				<span>{issue.phase}</span>
			{/if}
		</div>
	</a>
	{#if issue.operated_by}
		<div class="mt-[var(--gw-space-2)] border-t border-[var(--gw-color-border-subtle)] pt-[var(--gw-space-2)]">
			<OperatorBadge operator={issue.operated_by} compact />
		</div>
	{/if}
</div>
