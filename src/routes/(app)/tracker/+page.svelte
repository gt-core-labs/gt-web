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
	import { Spinner } from '$lib/components/ui';
	import IssueCard from '$lib/components/tracker/IssueCard.svelte';
	import CreateIssueModal from '$lib/components/tracker/CreateIssueModal.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let issues = $state<IssueRow[]>([]);
	$effect(() => {
		issues = [...data.issues];
	});

	const canWrite = $derived(hasScope(data.user?.scopes, 'issues.write'));

	// The active rig's bead prefix (what the store filters issues.rig by).
	const activePrefix = $derived(data.rigs.find((r) => r.name === data.activeRig)?.prefix);
	// The server load already narrows rows to the active rig, so trust them as-is.
	// (Re-filtering by id-prefix client-side would wrongly hide beads whose id
	// predates a prefix rename, e.g. old gw-* ids that now belong to rig "gtweb".)
	const visible = $derived(issues);
	let error = $state('');
	let showCreate = $state(false);
	let dragged = $state<string | null>(null);

	const loading = $derived(navigating.to?.route?.id === '/(app)/tracker');

	const COLUMNS: { status: IssueStatus; label: string; accent: string }[] = [
		{ status: 'open', label: 'Open', accent: 'var(--gw-color-primary)' },
		{ status: 'working', label: 'Working', accent: 'var(--gw-color-warning)' },
		{ status: 'closed', label: 'Closed', accent: 'var(--gw-color-success)' }
	];

	const byStatus = (s: IssueStatus) => visible.filter((i) => i.status === s);

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
		if (target === 'closed' || issue.status === 'closed') {
			error = 'Use the bead page to close / reopen.';
			return;
		}
		error = '';
		const prev = issue.status;
		issue.status = target;
		try {
			await browserTracker().transition(id, target);
			await invalidateAll();
		} catch (err) {
			issue.status = prev;
			error = err instanceof TrackerError ? `${err.status}: ${err.message}` : String(err);
		}
	}
</script>

<div class="flex flex-col gap-5 xl:gap-7">

	<!-- ── Header ─────────────────────────────────────────────────────────────── -->
	<header class="flex items-center justify-between gap-4">
		<div class="flex items-center gap-3">
			<h1 class="text-2xl font-bold tracking-tight text-[var(--gw-color-text)] xl:text-3xl">
				Tracker
			</h1>
			<span class="rounded-full border border-[var(--gw-color-border)] bg-[var(--gw-color-surface-3)] px-2.5 py-0.5 text-xs font-medium text-[var(--gw-color-text-muted)]">
				{activePrefix ? visible.length : data.total}
			</span>
			{#if loading}
				<Spinner size={1} label="Actualizando tracker" />
			{/if}
		</div>
		{#if canWrite}
			<!-- Button-in-Button CTA -->
			<button
				type="button"
				onclick={() => (showCreate = true)}
				class="group flex items-center gap-2 rounded-full bg-[var(--gw-color-primary)] px-4 py-2 text-sm font-medium text-white
					transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
					hover:opacity-90 active:scale-[0.98]
					focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gw-color-primary-focus)] focus-visible:ring-offset-2"
			>
				New bead
				<span class="flex h-5 w-5 items-center justify-center rounded-full bg-white/15 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px">
					<svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
						<path d="M3 1.5H8.5M8.5 1.5V7M8.5 1.5L1.5 8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				</span>
			</button>
		{/if}
	</header>

	<!-- ── Error ──────────────────────────────────────────────────────────────── -->
	{#if error}
		<div class="rounded-2xl border border-[var(--color-error-500)]/30 bg-[var(--color-error-500)]/8 px-4 py-3 font-mono text-sm text-[var(--color-error-500)]">
			{error}
		</div>
	{/if}

	<!-- ── Board ──────────────────────────────────────────────────────────────── -->
	{#if visible.length === 0 && !loading}
		<!-- Empty state -->
		<div class="flex flex-col items-center gap-4 py-24 text-center">
			<span class="text-4xl opacity-20">◇</span>
			<div class="flex flex-col gap-1">
				<p class="text-sm font-medium text-[var(--gw-color-text)]">Sin beads</p>
				<p class="max-w-xs text-xs text-[var(--gw-color-text-muted)]">
					{activePrefix
						? 'Este rig no tiene beads todavía.'
						: 'No hay beads en el tracker. Crea el primero para empezar.'}
				</p>
			</div>
			{#if canWrite}
				<button
					type="button"
					onclick={() => (showCreate = true)}
					class="mt-2 rounded-full border border-[var(--gw-color-border)] px-4 py-2 text-sm text-[var(--gw-color-text-muted)]
						transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
						hover:border-[var(--gw-color-primary)] hover:text-[var(--gw-color-primary)]
						focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gw-color-primary-focus)]"
				>
					New bead
				</button>
			{/if}
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-4 md:grid-cols-3 xl:gap-5">
			{#each COLUMNS as col (col.status)}
				{@const colItems = byStatus(col.status)}
				<section
					class="flex min-h-[60vh] flex-col gap-3 overflow-hidden rounded-2xl
						border border-[var(--gw-color-border)] bg-[var(--gw-color-surface-3)]
						transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
						[border-top-width:3px]"
					style="border-top-color: {col.accent}"
					role="list"
					ondragover={(e) => canWrite && e.preventDefault()}
					ondrop={(e) => { e.preventDefault(); if (canWrite) drop(col.status); }}
				>
					<!-- Column header -->
					<header class="flex items-center justify-between px-4 pt-4">
						<h2 class="flex items-center gap-2 text-sm font-semibold text-[var(--gw-color-text)]">
							<span
								aria-hidden="true"
								class="h-2 w-2 rounded-full"
								style="background-color: {col.accent}"
							></span>
							{col.label}
						</h2>
						<span class="rounded-full border border-[var(--gw-color-border)] px-2 py-px text-[10px] font-medium text-[var(--gw-color-text-muted)]">
							{colItems.length}
						</span>
					</header>

					<!-- Cards -->
					<div class="flex flex-1 flex-col gap-2 px-3 pb-3" role="list">
						{#each colItems as issue (issue.id)}
							<IssueCard {issue} draggable={canWrite} onpick={(id) => (dragged = id)} />
						{/each}
						{#if colItems.length === 0}
							<div
								class="flex flex-1 items-center justify-center rounded-xl
									border border-dashed border-[var(--gw-color-border)]
									px-4 py-8 text-center text-xs text-[var(--gw-color-text-muted)]"
							>
								Sin beads
							</div>
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
