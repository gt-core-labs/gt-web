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

	function dragstart(e: DragEvent) {
		e.dataTransfer?.setData('text/plain', issue.id);
		onpick?.(issue.id);
	}
</script>

<!-- The card is a wrapper div (not one big anchor) so the operator badge can carry its own
	terminal link without nesting anchors (hq-agent-observability.6). The title region stays the
	link to the bead detail. -->
<div class="card preset-filled-surface-100-900 space-y-1 p-3">
	<a
		href={`/tracker/${issue.id}`}
		class="block cursor-pointer space-y-1 hover:preset-tonal-primary"
		{draggable}
		ondragstart={dragstart}
	>
		<div class="flex items-center justify-between gap-2">
			<span class="font-mono text-xs opacity-70">{issue.id}</span>
			<Badge variant={prio[issue.priority] ?? 'surface'}>P{issue.priority}</Badge>
		</div>
		<p class="text-sm">{issue.title}</p>
		<div class="flex items-center gap-2 text-xs opacity-60">
			<span>{issue.issue_type}</span>
			{#if issue.assignee}<span>@{issue.assignee}</span>{/if}
			{#if issue.phase}<span>{issue.phase}</span>{/if}
		</div>
	</a>
	{#if issue.operated_by}
		<OperatorBadge operator={issue.operated_by} compact />
	{/if}
</div>
