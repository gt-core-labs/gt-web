<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import {
		browserBoard,
		browserReport,
		type BoardCard,
		type BoardColumn,
		type GroupBy
	} from '$lib/api/board';
	import { TrackerError, type IssueStatus } from '$lib/api/tracker';
	import { hasScope } from '$lib/api/auth';
	import CardDrawer from '$lib/components/kanban/CardDrawer.svelte';
	import CreateIssueModal from '$lib/components/tracker/CreateIssueModal.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Server snapshot, patched optimistically on drag and refreshed by SSE.
	let columns = $state<BoardColumn[]>([]);
	$effect(() => {
		columns = data.snapshot.columns.map((c) => ({ ...c, cards: [...c.cards] }));
	});

	const canWrite = $derived(hasScope(data.user?.scopes, 'issues.write'));
	const scopeKey = $derived({ rig: data.rig, workspace: data.boardWorkspace });

	let error = $state('');
	let selected = $state<BoardCard | null>(null);
	let showCreate = $state(false);
	let reportBusy = $state(false);
	let reportMsg = $state('');

	const COLUMNS: { status: IssueStatus; label: string; accent: string }[] = [
		{ status: 'open', label: 'Pendiente', accent: 'var(--gw-color-primary)' },
		{ status: 'working', label: 'En curso', accent: 'var(--gw-color-warning)' },
		{ status: 'closed', label: 'Hecho', accent: 'var(--gw-color-success)' }
	];

	const col = (s: IssueStatus) => columns.find((c) => c.status === s);

	// ── live updates: the board topic (hq-0c8fe1) ────────────────────────────
	$effect(() => {
		const topic = `board:${data.rig}:${data.boardWorkspace}`;
		const es = new EventSource(`/stream?topic=${encodeURIComponent(topic)}`, {
			withCredentials: true
		});
		let timer: ReturnType<typeof setTimeout> | null = null;
		const refresh = () => {
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => invalidateAll(), 400);
		};
		// A topic stream names frames by their kind; subscribe the families.
		for (const k of [
			'issues.created.v1',
			'issues.updated.v1',
			'issues.transitioned.v1',
			'issues.closed.v1',
			'issues.claimed.v1',
			'comments.created.v1',
			'comments.updated.v1',
			'comments.deleted.v1'
		])
			es.addEventListener(k, refresh as EventListener);
		return () => {
			es.close();
			if (timer) clearTimeout(timer);
		};
	});

	// ── drag-drop: position-aware placement via after/before neighbors ──────
	let dragged = $state<BoardCard | null>(null);
	let dropHint = $state<{ status: IssueStatus; index: number } | null>(null);

	function dragOverCard(e: DragEvent, status: IssueStatus, index: number) {
		e.preventDefault();
		const target = e.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		const below = e.clientY > rect.top + rect.height / 2;
		dropHint = { status, index: below ? index + 1 : index };
	}

	function dragOverColumn(e: DragEvent, status: IssueStatus) {
		e.preventDefault();
		if (!dropHint || dropHint.status !== status) {
			dropHint = { status, index: col(status)?.cards.length ?? 0 };
		}
	}

	async function drop(status: IssueStatus) {
		const card = dragged;
		const hint = dropHint;
		dragged = null;
		dropHint = null;
		if (!card || !hint || hint.status !== status) return;
		if (!canWrite) return;
		error = '';

		const target = col(status);
		if (!target) return;
		// Neighbors AROUND the insertion point, excluding the moving card itself.
		const others = target.cards.filter((c) => c.id !== card.id);
		const idx = Math.min(hint.index, others.length);
		const after = idx > 0 ? others[idx - 1]?.id : undefined;
		const before = idx < others.length ? others[idx]?.id : undefined;
		const sameColumn = card.status === status;
		if (sameColumn && after === undefined && before === undefined && others.length === 0) return;

		// Optimistic patch: lift the card out of its column, insert at the hint.
		const prev = columns.map((c) => ({ ...c, cards: [...c.cards] }));
		for (const c of columns) c.cards = c.cards.filter((x) => x.id !== card.id);
		const updated = { ...card, status };
		target.cards.splice(idx, 0, updated);
		columns = [...columns];

		try {
			if (sameColumn) {
				await browserBoard().reorder({ id: card.id, ...scopeKey, after, before });
			} else {
				await browserBoard().move({ id: card.id, ...scopeKey, column: status, after, before });
			}
		} catch (e) {
			columns = prev; // roll back; SSE/refresh reconciles
			error = e instanceof TrackerError ? e.message : String(e);
		}
	}

	// ── group-by / epic filters ride the URL so SSR + share links agree ─────
	function setParam(key: string, value: string) {
		const url = new URL(page.url);
		if (value) url.searchParams.set(key, value);
		else url.searchParams.delete(key);
		goto(url, { replaceState: true, invalidateAll: true });
	}

	async function generateReport() {
		reportBusy = true;
		reportMsg = '';
		try {
			const r = await browserReport().generate({ ...scopeKey, format: 'xlsx' });
			reportMsg = `Reporte ${r.filename} generado (${r.rows} tareas, TOTAL ${r.total_horas}h) — documento ${r.document_id}`;
		} catch (e) {
			// xlsx needs the object store; csv always works.
			try {
				const r = await browserReport().generate({ ...scopeKey, format: 'csv' });
				reportMsg = `Reporte CSV ${r.filename} generado (${r.rows} tareas, TOTAL ${r.total_horas}h)`;
			} catch (e2) {
				reportMsg = e2 instanceof TrackerError ? e2.message : String(e2);
			}
		} finally {
			reportBusy = false;
		}
	}

	const PRIORITY_DOT = ['bg-red-500', 'bg-amber-500', 'bg-slate-400'];
</script>

<svelte:head><title>Kanban · gt</title></svelte:head>

<div class="flex h-full flex-col gap-3 p-4">
	<!-- Intro / toolbar -->
	<header class="flex flex-wrap items-center gap-3">
		<div class="min-w-0 flex-1">
			<h1 class="text-lg font-semibold">Kanban · {data.rig}</h1>
			<p class="text-xs text-[var(--gw-color-text-muted)]">
				Tablero {data.rig}/{data.boardWorkspace} — arrastra para mover; el orden persiste (lexorank).
			</p>
		</div>

		<label class="text-xs">
			Agrupar
			<select
				class="ml-1 rounded border border-[var(--gw-color-border)] bg-transparent px-2 py-1 text-sm"
				value={data.groupBy}
				onchange={(e) => setParam('group_by', (e.currentTarget as HTMLSelectElement).value)}
			>
				<option value="">—</option>
				<option value="assignee">Responsable</option>
				<option value="epic">Módulo (epic)</option>
				<option value="priority">Prioridad</option>
			</select>
		</label>

		<input
			class="w-40 rounded border border-[var(--gw-color-border)] bg-transparent px-2 py-1 text-sm"
			placeholder="Filtrar por epic…"
			value={data.epic}
			onchange={(e) => setParam('epic', (e.currentTarget as HTMLInputElement).value.trim())}
		/>

		{#if canWrite}
			<button
				class="rounded bg-[var(--gw-color-primary)] px-3 py-1.5 text-sm text-white"
				onclick={() => (showCreate = true)}
			>Reportar tarea</button>
		{/if}
		<button
			class="rounded border border-[var(--gw-color-border)] px-3 py-1.5 text-sm disabled:opacity-50"
			disabled={reportBusy}
			onclick={generateReport}
		>{reportBusy ? 'Generando…' : 'Reporte'}</button>
	</header>

	{#if error}<p class="text-sm text-[var(--gw-color-danger)]">{error}</p>{/if}
	{#if reportMsg}<p class="text-sm text-[var(--gw-color-text-muted)]">{reportMsg}</p>{/if}

	<!-- Board -->
	<div class="grid min-h-0 flex-1 grid-cols-3 gap-3">
		{#each COLUMNS as { status, label, accent } (status)}
			{@const column = col(status)}
			<section
				class="flex min-h-0 flex-col rounded-xl border border-[var(--gw-color-border)] bg-[var(--gw-color-surface-2)]"
				role="list"
				aria-label={label}
				ondragover={(e) => dragOverColumn(e, status)}
				ondrop={() => drop(status)}
			>
				<header class="flex items-center gap-2 border-b border-[var(--gw-color-border)] px-3 py-2">
					<span class="h-2 w-2 rounded-full" style:background={accent}></span>
					<h2 class="text-sm font-medium">{label}</h2>
					<span class="ml-auto text-xs text-[var(--gw-color-text-muted)]">{column?.cards.length ?? 0}</span>
				</header>

				<div class="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
					{#if data.groupBy && column?.lanes}
						{#each column.lanes as lane (lane.key)}
							<p class="px-1 pt-1 text-[11px] font-semibold uppercase text-[var(--gw-color-text-muted)]">
								{lane.key || 'Sin asignar'}
							</p>
							{#each lane.cards as card (card.id)}
								<button
									class="block w-full rounded-lg border border-[var(--gw-color-border)] bg-[var(--gw-color-surface)] p-2 text-left text-sm hover:border-[var(--gw-color-primary)]"
									onclick={() => (selected = card)}
								>
									<span class="font-mono text-[11px] text-[var(--gw-color-text-muted)]">{card.id}</span>
									<span class="block truncate">{card.title}</span>
								</button>
							{/each}
						{/each}
					{:else}
						{#each column?.cards ?? [] as card, index (card.id)}
							{#if dropHint && dropHint.status === status && dropHint.index === index && dragged && dragged.id !== card.id}
								<div class="h-1 rounded bg-[var(--gw-color-primary)]"></div>
							{/if}
							<div
								class="cursor-grab rounded-lg border border-[var(--gw-color-border)] bg-[var(--gw-color-surface)] p-2 text-sm hover:border-[var(--gw-color-primary)] {dragged?.id === card.id ? 'opacity-40' : ''}"
								draggable={canWrite}
								role="listitem"
								ondragstart={() => (dragged = card)}
								ondragend={() => { dragged = null; dropHint = null; }}
								ondragover={(e) => dragOverCard(e, status, index)}
							>
								<button class="block w-full text-left" onclick={() => (selected = card)}>
									<span class="flex items-center gap-2">
										<span class="h-1.5 w-1.5 shrink-0 rounded-full {PRIORITY_DOT[card.priority] ?? PRIORITY_DOT[2]}"></span>
										<span class="truncate font-mono text-[11px] text-[var(--gw-color-text-muted)]">{card.id}</span>
										{#if card.estimated_hours != null}
											<span class="ml-auto shrink-0 text-[11px] text-[var(--gw-color-text-muted)]">{card.estimated_hours}h</span>
										{/if}
									</span>
									<span class="mt-0.5 block truncate">{card.title}</span>
									{#if card.assignee || card.due_date}
										<span class="mt-1 flex gap-2 text-[11px] text-[var(--gw-color-text-muted)]">
											{#if card.assignee}<span>@{card.assignee}</span>{/if}
											{#if card.due_date}<span class="ml-auto">{card.due_date}</span>{/if}
										</span>
									{/if}
								</button>
							</div>
						{/each}
						{#if dropHint && dropHint.status === status && dropHint.index === (column?.cards.length ?? 0) && dragged}
							<div class="h-1 rounded bg-[var(--gw-color-primary)]"></div>
						{/if}
					{/if}
				</div>
			</section>
		{/each}
	</div>
</div>

{#if selected}
	<CardDrawer card={selected} onClose={() => (selected = null)} />
{/if}

{#if showCreate}
	<CreateIssueModal createdBy={data.user?.sub ?? 'gt-web'} onclose={() => (showCreate = false)} />
{/if}
