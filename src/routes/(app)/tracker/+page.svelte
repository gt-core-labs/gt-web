<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { navigating } from '$app/state';
	import {
		browserTracker,
		ISSUE_EVENT_KINDS,
		TrackerError,
		type IssueRow,
		type IssueStatus
	} from '$lib/api/tracker';
	import { hasScope } from '$lib/api/auth';
	import { beadInRig } from '$lib/rig';
	import { Badge, Button } from '$lib/ui';
	import { Alert, EmptyState, Spinner } from '$lib/components/ui';
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

	// Scope the board to the active rig: bead ids are `<prefix>-<slug>`, so filter by
	// the selected rig's prefix. No active rig ⇒ every bead (the "all rigs" view).
	const activePrefix = $derived(data.rigs.find((r) => r.name === data.activeRig)?.prefix);
	const visible = $derived(issues.filter((i) => beadInRig(i.id, activePrefix)));
	let error = $state('');
	let showCreate = $state(false);
	let dragged = $state<string | null>(null);

	// A navigation into the tracker (e.g. switching rig → invalidateAll) re-runs the
	// server load; surface that as a designed loading state instead of a silent stall.
	const loading = $derived(navigating.to?.route?.id === '/(app)/tracker');

	// `accent` colours the column's top bar + header dot so a status reads at a glance:
	// Open = primary (blue), Working = amber, Closed = green.
	const COLUMNS: { status: IssueStatus; label: string; accent: string }[] = [
		{ status: 'open', label: 'Open', accent: 'var(--gw-color-primary)' },
		{ status: 'working', label: 'Working', accent: 'var(--gw-color-warning)' },
		{ status: 'closed', label: 'Closed', accent: 'var(--gw-color-success)' }
	];

	const byStatus = (s: IssueStatus) => visible.filter((i) => i.status === s);

	// Live refresh: reconnects when activeRig changes so the stream only delivers events
	// for the active rig (hq-rig-isolation.3/.4). A burst collapses to one invalidate.
	// Use the rig PREFIX (e.g. "gw") because that's what the store and SSE filter on.
	$effect(() => {
		const url = activePrefix
			? `/stream?channel=issues&rig=${encodeURIComponent(activePrefix)}`
			: '/stream?channel=issues';
		const es = new EventSource(url, { withCredentials: true });
		let timer: ReturnType<typeof setTimeout> | null = null;
		const refresh = () => {
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => invalidateAll(), 400);
		};
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

<div class="space-y-[var(--gw-space-5)]">
	<header class="flex items-center justify-between gap-[var(--gw-space-4)]">
		<div class="flex items-center gap-[var(--gw-space-3)]">
			<h1 class="text-[var(--gw-text-2xl)] font-semibold tracking-tight text-[var(--gw-color-text)]">
				Tracker
			</h1>
			<span
				class="rounded-[var(--gw-radius-full)] bg-[var(--gw-color-surface-3)]
					px-[var(--gw-space-2)] py-[2px] text-[var(--gw-text-xs)] font-medium text-[var(--gw-color-text-muted)]"
			>
				{activePrefix ? visible.length : data.total}
			</span>
			{#if loading}<Spinner size={1} label="Actualizando tracker" />{/if}
		</div>
		{#if canWrite}
			<Button onclick={() => (showCreate = true)}>New bead</Button>
		{/if}
	</header>

	{#if error}
		<Alert variant="error">{error}</Alert>
	{/if}

	{#if visible.length === 0 && !loading}
		<EmptyState
			icon="◇"
			title="Sin beads"
			description={activePrefix
				? 'Este rig no tiene beads todavía. Crea el primero para empezar a trabajar.'
				: 'No hay beads en el tracker. Crea el primero para empezar a trabajar.'}
		>
			{#if canWrite}
				<Button onclick={() => (showCreate = true)}>New bead</Button>
			{/if}
		</EmptyState>
	{:else}
		<div class="grid grid-cols-1 gap-[var(--gw-space-4)] md:grid-cols-3">
			{#each COLUMNS as col (col.status)}
				{@const items = byStatus(col.status)}
				<section
					class="flex min-h-[60vh] flex-col gap-[var(--gw-space-3)]
						rounded-[var(--gw-radius-lg)] border border-t-[3px] border-[var(--gw-color-border-subtle)]
						bg-[var(--gw-color-surface-2)] p-[var(--gw-space-3)]
						transition-colors duration-[var(--gw-duration-fast)]"
					style="border-top-color: {col.accent}"
					role="list"
					ondragover={(e) => canWrite && e.preventDefault()}
					ondrop={(e) => {
						e.preventDefault();
						if (canWrite) drop(col.status);
					}}
				>
					<header class="flex items-center justify-between px-[var(--gw-space-1)]">
						<h2
							class="flex items-center gap-[var(--gw-space-2)]
								text-[var(--gw-text-sm)] font-semibold text-[var(--gw-color-text)]"
						>
							<span
								aria-hidden="true"
								class="h-2 w-2 rounded-[var(--gw-radius-full)]"
								style="background-color: {col.accent}"
							></span>
							{col.label}
						</h2>
						<Badge variant="surface">{items.length}</Badge>
					</header>
					<div class="flex flex-1 flex-col gap-[var(--gw-space-2)]">
						{#each items as issue (issue.id)}
							<IssueCard {issue} draggable={canWrite} onpick={(id) => (dragged = id)} />
						{/each}
						{#if items.length === 0}
							<p
								class="flex flex-1 items-center justify-center rounded-[var(--gw-radius-md)]
									border border-dashed border-[var(--gw-color-border-subtle)]
									px-[var(--gw-space-3)] py-[var(--gw-space-6)]
									text-center text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]"
							>
								Sin beads en {col.label.toLowerCase()}
							</p>
						{/if}
					</div>
				</section>
			{/each}
		</div>
	{/if}
</div>

{#if showCreate}
	<CreateIssueModal createdBy={data.user?.sub ?? 'gt-web'} onclose={() => (showCreate = false)} />
{/if}
