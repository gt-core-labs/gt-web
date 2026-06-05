<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import {
		browserTracker,
		ISSUE_EVENT_KINDS,
		TrackerError,
		type IssueRow,
		type IssueStatus
	} from '$lib/api/tracker';
	import { hasScope } from '$lib/api/auth';
	import { Badge, Button } from '$lib/ui';
	import IssueCard from '$lib/components/tracker/IssueCard.svelte';
	import CreateIssueModal from '$lib/components/tracker/CreateIssueModal.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Local optimistic copy; populated + resynced from loaded data via the effect
	// (so an optimistic drag can mutate it, then invalidateAll re-seeds it).
	let issues = $state<IssueRow[]>([]);
	$effect(() => {
		issues = [...data.issues];
	});

	const canWrite = $derived(hasScope(data.user?.scopes, 'issues.write'));
	let error = $state('');
	let showCreate = $state(false);
	let dragged = $state<string | null>(null);

	const COLUMNS: { status: IssueStatus; label: string }[] = [
		{ status: 'open', label: 'Open' },
		{ status: 'working', label: 'Working' },
		{ status: 'closed', label: 'Closed' }
	];

	const byStatus = (s: IssueStatus) => issues.filter((i) => i.status === s);

	// Live refresh: every issue mutation (any session, REST or MCP) publishes an
	// `issues.*.v1` event onto `/stream?channel=issues`. Re-pull the SSR list on each,
	// debounced so a burst (e.g. an epic + its beads) collapses to one refetch. The
	// EventSource carries the gt_web_token cookie (Path=/) for auth — it cannot set an
	// Authorization header. `?channel=issues` keeps the merge/convoy/quota feed out.
	onMount(() => {
		const es = new EventSource('/stream?channel=issues', { withCredentials: true });
		let timer: ReturnType<typeof setTimeout> | null = null;
		const refresh = () => {
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => invalidateAll(), 400);
		};
		// EventSource needs a listener per named kind — there is no catch-all for named events.
		for (const k of ISSUE_EVENT_KINDS) es.addEventListener(k, refresh as EventListener);
		return () => {
			es.close();
			if (timer) clearTimeout(timer);
		};
	});

	async function drop(target: IssueStatus) {
		const id = dragged;
		dragged = null;
		if (!id) return;
		const issue = issues.find((i) => i.id === id);
		if (!issue || issue.status === target) return;
		// closing through the board needs the close endpoint (commit_sha rules) —
		// keep drag to open<->working; closing happens on the detail page.
		if (target === 'closed' || issue.status === 'closed') {
			error = 'Use the bead page to close / reopen.';
			return;
		}
		error = '';
		const prev = issue.status;
		issue.status = target; // optimistic
		try {
			await browserTracker().transition(id, target);
			await invalidateAll();
		} catch (err) {
			issue.status = prev; // revert
			error = err instanceof TrackerError ? `${err.status}: ${err.message}` : String(err);
		}
	}
</script>

<div class="space-y-4">
	<header class="flex items-center justify-between">
		<h1 class="h2">Tracker <span class="text-base opacity-60">({data.total})</span></h1>
		{#if canWrite}
			<Button onclick={() => (showCreate = true)}>New bead</Button>
		{/if}
	</header>

	{#if error}<p class="text-sm text-error-500">{error}</p>{/if}

	<div class="grid grid-cols-3 gap-4">
		{#each COLUMNS as col (col.status)}
			<section
				class="card preset-tonal-surface min-h-[60vh] space-y-2 p-3"
				role="list"
				ondragover={(e) => canWrite && e.preventDefault()}
				ondrop={(e) => {
					e.preventDefault();
					if (canWrite) drop(col.status);
				}}
			>
				<header class="flex items-center justify-between">
					<h2 class="font-semibold">{col.label}</h2>
					<Badge variant="surface">{byStatus(col.status).length}</Badge>
				</header>
				{#each byStatus(col.status) as issue (issue.id)}
					<IssueCard {issue} draggable={canWrite} onpick={(id) => (dragged = id)} />
				{/each}
			</section>
		{/each}
	</div>
</div>

{#if showCreate}
	<CreateIssueModal createdBy={data.user?.sub ?? 'gt-web'} onclose={() => (showCreate = false)} />
{/if}
