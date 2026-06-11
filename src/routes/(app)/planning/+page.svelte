<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { browserTracker, TrackerError, type IssueRow } from '$lib/api/tracker';
	import { hasScope } from '$lib/api/auth';
	import CreateIssueModal from '$lib/components/tracker/CreateIssueModal.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let rows = $state<IssueRow[]>([]);
	$effect(() => {
		rows = [...data.rows];
	});

	const canWrite = $derived(hasScope(data.user?.scopes, 'issues.write'));
	let error = $state('');
	let showCreate = $state(false);

	// Module = epic (ADR D5, epic-per-module via external_ref). Epics title the
	// sections and are not task rows; the no-module tail renders last.
	const epics = $derived(rows.filter((r) => r.issue_type === 'epic'));
	const epicTitle = (id: string) => epics.find((e) => e.id === id)?.title ?? id;
	const tasks = $derived(rows.filter((r) => r.issue_type !== 'epic'));
	const modules = $derived.by(() => {
		const byModule = new Map<string, IssueRow[]>();
		for (const t of tasks) {
			const key = t.external_ref ?? '';
			byModule.set(key, [...(byModule.get(key) ?? []), t]);
		}
		const sections = [...byModule.entries()]
			.map(([id, items]) => ({
				id,
				title: id ? epicTitle(id) : 'Sin módulo',
				items,
				horas: items.reduce((acc, r) => acc + (r.estimated_hours ?? 0), 0)
			}))
			.sort((a, b) =>
				a.id === '' ? 1 : b.id === '' ? -1 : a.title.localeCompare(b.title)
			);
		return sections;
	});
	const totalHoras = $derived(modules.reduce((acc, m) => acc + m.horas, 0));

	const ESTADO: Record<string, string> = { open: 'Pendiente', working: 'En curso', closed: 'Hecho' };

	/** Inline edit: persist one planning field via issues.update (hq-62130a). */
	async function patch(row: IssueRow, field: 'estimated_hours' | 'start_date' | 'due_date' | 'assignee', raw: string) {
		error = '';
		const value = raw.trim();
		const body =
			field === 'estimated_hours'
				? { estimated_hours: value === '' ? 0 : Number(value) }
				: { [field]: value };
		if (field === 'estimated_hours' && value !== '' && !Number.isFinite(Number(value))) {
			error = 'Horas debe ser un número';
			return;
		}
		try {
			await browserTracker().update(row.id, body);
			await invalidateAll();
		} catch (e) {
			error = e instanceof TrackerError ? e.message : String(e);
		}
	}

	const inputCls =
		'w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-[var(--gw-color-border)] focus:border-[var(--gw-color-primary)] focus:outline-none disabled:opacity-60';
</script>

<svelte:head><title>Planning · gt</title></svelte:head>

<div class="space-y-4 p-4">
	<header class="flex flex-wrap items-center gap-3">
		<div class="min-w-0 flex-1">
			<h1 class="text-lg font-semibold">Planificación · {data.rig}</h1>
			<p class="text-xs text-[var(--gw-color-text-muted)]">
				Vista por módulo (epic) — edita Horas/Fechas/Responsable en línea; persiste en el tablero.
			</p>
		</div>
		{#if canWrite}
			<button
				class="rounded bg-[var(--gw-color-primary)] px-3 py-1.5 text-sm text-white"
				onclick={() => (showCreate = true)}
			>Reportar tarea</button>
		{/if}
		<a class="text-sm text-[var(--gw-color-primary)] hover:underline" href="/kanban">Ver Kanban →</a>
	</header>

	{#if error}<p class="text-sm text-[var(--gw-color-danger)]">{error}</p>{/if}

	{#each modules as module (module.id)}
		<section class="overflow-x-auto rounded-xl border border-[var(--gw-color-border)]">
			<header class="flex items-center gap-2 border-b border-[var(--gw-color-border)] bg-[var(--gw-color-surface-2)] px-3 py-2">
				<h2 class="text-sm font-semibold">{module.title}</h2>
				{#if module.id}<span class="font-mono text-[11px] text-[var(--gw-color-text-muted)]">{module.id}</span>{/if}
				<span class="ml-auto text-xs text-[var(--gw-color-text-muted)]">{module.horas} h</span>
			</header>
			<table class="w-full text-sm">
				<thead>
					<tr class="text-left text-[11px] uppercase text-[var(--gw-color-text-muted)]">
						<th class="px-3 py-1.5">Tarea</th>
						<th class="px-2 py-1.5">Proceso</th>
						<th class="px-2 py-1.5">Nivel</th>
						<th class="px-2 py-1.5 w-24">Horas Est.</th>
						<th class="px-2 py-1.5">Estado</th>
						<th class="px-2 py-1.5 w-32">Responsable</th>
						<th class="px-2 py-1.5 w-36">Fecha Inicio</th>
						<th class="px-2 py-1.5 w-36">Fecha Fin</th>
					</tr>
				</thead>
				<tbody>
					{#each module.items as row (row.id)}
						<tr class="border-t border-[var(--gw-color-border)]">
							<td class="px-3 py-1.5">
								<span class="block truncate" title={row.id}>{row.title}</span>
							</td>
							<td class="px-2 py-1.5">{row.issue_type}</td>
							<td class="px-2 py-1.5">P{row.priority}</td>
							<td class="px-2 py-1.5">
								<input
									class={inputCls}
									type="number" min="0" step="0.5"
									value={row.estimated_hours ?? ''}
									disabled={!canWrite}
									onchange={(e) => patch(row, 'estimated_hours', (e.currentTarget as HTMLInputElement).value)}
								/>
							</td>
							<td class="px-2 py-1.5">{ESTADO[row.status] ?? row.status}</td>
							<td class="px-2 py-1.5">
								<input
									class={inputCls}
									value={row.assignee ?? ''}
									placeholder="—"
									disabled={!canWrite}
									onchange={(e) => patch(row, 'assignee', (e.currentTarget as HTMLInputElement).value)}
								/>
							</td>
							<td class="px-2 py-1.5">
								<input
									class={inputCls}
									type="date"
									value={row.start_date ?? ''}
									disabled={!canWrite}
									onchange={(e) => patch(row, 'start_date', (e.currentTarget as HTMLInputElement).value)}
								/>
							</td>
							<td class="px-2 py-1.5">
								<input
									class={inputCls}
									type="date"
									value={row.due_date ?? ''}
									disabled={!canWrite}
									onchange={(e) => patch(row, 'due_date', (e.currentTarget as HTMLInputElement).value)}
								/>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	{:else}
		<p class="text-sm text-[var(--gw-color-text-muted)]">Sin tareas en este rig.</p>
	{/each}

	<footer class="flex justify-end rounded-xl border border-[var(--gw-color-border)] bg-[var(--gw-color-surface-2)] px-4 py-2 text-sm font-semibold">
		TOTAL HORAS: {totalHoras} h
	</footer>
</div>

{#if showCreate}
	<CreateIssueModal createdBy={data.user?.sub ?? 'gt-web'} onclose={() => (showCreate = false)} />
{/if}
