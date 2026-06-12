<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { browserReport } from '$lib/api/board';
	import { browserTracker, TrackerError, parseJsonArray, type IssueRow } from '$lib/api/tracker';
	import { hasScope } from '$lib/api/auth';
	import CardDrawer from '$lib/components/kanban/CardDrawer.svelte';
	import AssigneeSelect from '$lib/components/tracker/AssigneeSelect.svelte';
	import CreateIssueModal from '$lib/components/tracker/CreateIssueModal.svelte';
	import { Icon } from '$lib/ui';
	import { Spinner } from '$lib/components/ui';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let rows = $state<IssueRow[]>([]);
	$effect(() => {
		rows = [...data.rows];
	});

	const canWrite = $derived(hasScope(data.user?.scopes, 'issues.write'));
	let error = $state('');
	let showCreate = $state(false);
	let selected = $state<IssueRow | null>(null);
	let groupBy = $state<'module' | 'week'>('week');

	// Module = epic (ADR D5, epic-per-module via external_ref). Epics title the
	// sections and are not task rows; the no-module tail renders last.
	const epics = $derived(rows.filter((r) => r.issue_type === 'epic'));
	const epicTitle = (id: string) => epics.find((e) => e.id === id)?.title ?? id;
	const tasks = $derived(rows.filter((r) => r.issue_type !== 'epic'));

	interface Section {
		id: string;
		title: string;
		/** Week chip (e.g. "WEEK 24") — week grouping only. */
		badge?: string;
		/** Date range label (e.g. "Jun 8, 2026 → Jun 14, 2026") — week grouping only. */
		range?: string;
		items: IssueRow[];
		hours: number;
	}

	// ── week grouping: ISO week of start_date (due_date fallback) ───────────
	/** Monday of the ISO week containing `d` (UTC, date-only). */
	function isoMonday(d: Date): Date {
		const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
		m.setUTCDate(m.getUTCDate() - ((m.getUTCDay() + 6) % 7));
		return m;
	}
	function isoWeekNumber(monday: Date): number {
		// ISO 8601: week containing the Thursday belongs to that year.
		const thursday = new Date(monday);
		thursday.setUTCDate(thursday.getUTCDate() + 3);
		const jan1 = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
		return Math.ceil(((thursday.getTime() - jan1.getTime()) / 86400000 + 1) / 7);
	}
	const fmtDay = (d: Date) =>
		d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

	function weekKey(row: IssueRow): string {
		const raw = row.start_date || row.due_date;
		if (!raw) return '';
		const d = new Date(`${raw}T00:00:00Z`);
		if (Number.isNaN(d.getTime())) return '';
		return isoMonday(d).toISOString().slice(0, 10);
	}

	const sections = $derived.by<Section[]>(() => {
		const byKey = new Map<string, IssueRow[]>();
		for (const t of tasks) {
			const key = groupBy === 'module' ? (t.external_ref ?? '') : weekKey(t);
			byKey.set(key, [...(byKey.get(key) ?? []), t]);
		}
		const out = [...byKey.entries()].map(([id, items]): Section => {
			const hours = items.reduce((acc, r) => acc + (r.estimated_hours ?? 0), 0);
			if (groupBy === 'module') {
				return { id, title: id ? epicTitle(id) : 'No module', items, hours };
			}
			if (!id) return { id, title: 'Unscheduled', items, hours };
			const monday = new Date(`${id}T00:00:00Z`);
			const sunday = new Date(monday);
			sunday.setUTCDate(sunday.getUTCDate() + 6);
			const n = isoWeekNumber(monday);
			return {
				id,
				title: `Week ${n}`,
				badge: `WEEK ${n}`,
				range: `${fmtDay(monday)} → ${fmtDay(sunday)}`,
				items,
				hours
			};
		});
		// Module: alphabetical, no-module last. Week: chronological, unscheduled last.
		return out.sort((a, b) =>
			a.id === '' ? 1 : b.id === '' ? -1 : groupBy === 'module' ? a.title.localeCompare(b.title) : a.id.localeCompare(b.id)
		);
	});
	const totalHours = $derived(sections.reduce((acc, s) => acc + s.hours, 0));

	const STATUS: Record<string, { label: string; cls: string }> = {
		open: { label: 'Pending', cls: 'bg-[var(--gw-color-surface-2)] text-[var(--gw-color-text-muted)]' },
		working: { label: 'In progress', cls: 'bg-amber-500/15 text-amber-500' },
		closed: { label: 'Done', cls: 'bg-emerald-500/15 text-emerald-500' }
	};

	/** Inline edit: persist one field via issues.update (hq-62130a, hq-039316). */
	async function patch(
		row: IssueRow,
		field: 'estimated_hours' | 'start_date' | 'due_date' | 'assignee' | 'priority' | 'issue_type',
		raw: string
	) {
		error = '';
		const value = raw.trim();
		if (field === 'estimated_hours' && value !== '' && !Number.isFinite(Number(value))) {
			error = 'Hours must be a number';
			return;
		}
		if (field === 'issue_type' && value === '') {
			error = 'Type cannot be empty';
			return;
		}
		const body =
			field === 'estimated_hours'
				? { estimated_hours: value === '' ? 0 : Number(value) }
				: field === 'priority'
					? { priority: Number(value) }
					: { [field]: value };
		try {
			await browserTracker().update(row.id, body);
			await invalidateAll();
		} catch (e) {
			error = e instanceof TrackerError ? e.message : String(e);
		}
	}

	/** Manual archiving (hq-039316): re-scope the card to the `archive` board
	 * workspace (or back) — it disappears from the default views. */
	async function toggleArchive(row: IssueRow) {
		error = '';
		try {
			await browserTracker().update(row.id, { workspace: data.archived ? 'default' : 'archive' });
			await invalidateAll();
		} catch (e) {
			error = e instanceof TrackerError ? e.message : String(e);
		}
	}

	/** Type categories already in use on this board — the datalist lets the user
	 * pick one or type a new category (hq-039316). */
	const typeOptions = $derived([...new Set(rows.map((r) => r.issue_type).filter(Boolean))].sort());

	// ── export (hq-039316): client-side CSV of the visible sections ─────────
	function csvCell(v: string | number | null | undefined): string {
		const s = v == null ? '' : String(v);
		return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
	}
	function exportCsv() {
		const header = ['section', 'id', 'title', 'status', 'type', 'priority', 'tags', 'hours', 'assignee', 'start_date', 'due_date'];
		const lines = [header.join(',')];
		for (const s of sections) {
			for (const r of s.items) {
				lines.push(
					[
						s.title,
						r.id,
						r.title,
						r.status,
						r.issue_type,
						`P${r.priority}`,
						parseJsonArray(r.domain_json).join(' '),
						r.estimated_hours ?? '',
						r.assignee ?? '',
						r.start_date ?? '',
						r.due_date ?? ''
					].map(csvCell).join(',')
				);
			}
		}
		const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `planning-${data.rig}-${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	// Server-side operator spreadsheet (hq-fc7d6a) — same pattern as kanban.
	let reportBusy = $state(false);
	let reportMsg = $state('');
	let reportDoc = $state<{ id: string; filename: string } | null>(null);
	async function generateReport() {
		reportBusy = true;
		reportMsg = '';
		reportDoc = null;
		const scope = { rig: data.rig, workspace: data.boardWorkspace };
		try {
			const r = await browserReport().generate({ ...scope, format: 'xlsx' });
			reportMsg = `Report ${r.filename} generated (${r.rows} tasks, TOTAL ${r.total_horas}h)`;
			reportDoc = { id: r.document_id, filename: r.filename };
		} catch {
			// xlsx needs the object store; csv always works.
			try {
				const r = await browserReport().generate({ ...scope, format: 'csv' });
				reportMsg = `CSV report ${r.filename} generated (${r.rows} tasks, TOTAL ${r.total_horas}h)`;
				reportDoc = { id: r.document_id, filename: r.filename };
			} catch (e2) {
				reportMsg = e2 instanceof TrackerError ? e2.message : String(e2);
			}
		} finally {
			reportBusy = false;
		}
	}

	const inputCls =
		'w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-[var(--gw-color-border)] focus:border-[var(--gw-color-primary)] focus:outline-none disabled:opacity-60';
</script>

<svelte:head><title>Planning · gt</title></svelte:head>

<div class="space-y-4 p-4">
	<header class="flex flex-wrap items-center gap-3">
		<div class="min-w-0 flex-1">
			<h1 class="text-lg font-semibold">Planning · {data.rig}</h1>
			<p class="text-xs text-[var(--gw-color-text-muted)]">
				Grouped by {groupBy === 'week' ? 'week' : 'module (epic)'} — edit hours/dates/assignee inline; click a task to open its card.
			</p>
		</div>

		<div class="flex rounded border border-[var(--gw-color-border)] text-xs" role="group" aria-label="Group by">
			{#each [['week', 'By week'], ['module', 'By module']] as [value, label] (value)}
				<button
					class="px-3 py-1.5 {groupBy === value ? 'bg-[var(--gw-color-primary)] text-white' : 'text-[var(--gw-color-text-muted)] hover:bg-[var(--gw-color-surface-2)]'}"
					onclick={() => (groupBy = value as 'module' | 'week')}
				>{label}</button>
			{/each}
		</div>

		{#if canWrite}
			<button
				class="rounded bg-[var(--gw-color-primary)] px-3 py-1.5 text-sm text-white"
				onclick={() => (showCreate = true)}
			>New task</button>
		{/if}
		<a
			class="rounded border border-[var(--gw-color-border)] p-1.5 hover:bg-[var(--gw-color-surface-2)]"
			href="/calendar"
			title="Calendar view"
			aria-label="Switch to calendar view"
		><Icon icon="lucide:calendar" size={16} /></a>
		<button
			class="rounded border border-[var(--gw-color-border)] p-1.5 hover:bg-[var(--gw-color-surface-2)]"
			title="Export CSV (visible rows)"
			aria-label="Export CSV"
			onclick={exportCsv}
		><Icon icon="lucide:download" size={16} /></button>
		<button
			class="rounded border border-[var(--gw-color-border)] p-1.5 hover:bg-[var(--gw-color-surface-2)] disabled:opacity-50"
			title="Generate xlsx report (operator spreadsheet)"
			aria-label="Generate xlsx report"
			disabled={reportBusy}
			onclick={generateReport}
		>{#if reportBusy}<Spinner size={1} />{:else}<Icon icon="lucide:file-spreadsheet" size={16} />{/if}</button>
		<a
			class="rounded border border-[var(--gw-color-border)] p-1.5 hover:bg-[var(--gw-color-surface-2)] {data.archived ? 'bg-[var(--gw-color-surface-2)]' : ''}"
			href={data.archived ? '/planning' : '/planning?archived=1'}
			title={data.archived ? 'Back to planning' : 'View archived'}
			aria-label={data.archived ? 'Back to planning' : 'View archived'}
		><Icon icon={data.archived ? 'lucide:archive-restore' : 'lucide:archive'} size={16} /></a>
		<a class="text-sm text-[var(--gw-color-primary)] hover:underline" href="/kanban">View Kanban →</a>
	</header>

	{#if error}<p class="text-sm text-[var(--gw-color-danger)]">{error}</p>{/if}
	{#if reportMsg}
		<p class="text-sm text-[var(--gw-color-text-muted)]">
			{reportMsg}
			{#if reportDoc}
				<a
					class="inline-flex translate-y-0.5 items-center text-[var(--gw-color-primary)] hover:underline"
					href="/api/v1/documents/{encodeURIComponent(reportDoc.id)}/download"
					download={reportDoc.filename}
					title="Download {reportDoc.filename}"
					aria-label="Download {reportDoc.filename}"
				><Icon icon="lucide:download" size={14} /></a>
			{/if}
		</p>
	{/if}

	{#each sections as section (section.id)}
		<section class="overflow-x-auto rounded-xl border border-[var(--gw-color-border)]">
			<header class="flex items-center gap-2 border-b border-[var(--gw-color-border)] bg-[var(--gw-color-surface-2)] px-3 py-2">
				{#if section.badge}
					<span class="rounded bg-[var(--gw-color-primary)]/15 px-2 py-0.5 text-[11px] font-semibold text-[var(--gw-color-primary)]">{section.badge}</span>
				{/if}
				<h2 class="text-sm font-semibold">{section.title}</h2>
				{#if section.range}
					<span class="text-xs text-[var(--gw-color-text-muted)]">{section.range}</span>
				{:else if groupBy === 'module' && section.id}
					<span class="font-mono text-[11px] text-[var(--gw-color-text-muted)]">{section.id}</span>
				{/if}
				<span class="ml-auto text-xs text-[var(--gw-color-text-muted)]">{section.items.length} tasks · {section.hours} h</span>
			</header>
			<table class="w-full text-sm">
				<thead>
					<tr class="text-left text-[11px] uppercase text-[var(--gw-color-text-muted)]">
						<th class="px-3 py-1.5">Task</th>
						<th class="px-2 py-1.5">Status</th>
						<th class="px-2 py-1.5">Tags</th>
						<th class="px-2 py-1.5 w-24">Type</th>
						<th class="px-2 py-1.5 w-20">Priority</th>
						<th class="px-2 py-1.5 w-24">Est. hours</th>
						<th class="px-2 py-1.5 w-32">Assignee</th>
						<th class="px-2 py-1.5 w-36">Start date</th>
						<th class="px-2 py-1.5 w-36">Due date</th>
						{#if canWrite}<th class="px-2 py-1.5 w-10"><span class="sr-only">Archive</span></th>{/if}
					</tr>
				</thead>
				<tbody>
					{#each section.items as row (row.id)}
						<tr class="border-t border-[var(--gw-color-border)]">
							<td class="px-3 py-1.5">
								<button
									class="block w-full truncate text-left hover:text-[var(--gw-color-primary)] hover:underline"
									title={row.id}
									onclick={() => (selected = row)}
								>{row.title}</button>
							</td>
							<td class="px-2 py-1.5">
								<span class="rounded px-2 py-0.5 text-xs {STATUS[row.status]?.cls ?? ''}">
									{STATUS[row.status]?.label ?? row.status}
								</span>
							</td>
							<td class="px-2 py-1.5">
								<span class="flex flex-wrap gap-1">
									{#each parseJsonArray(row.domain_json) as tag (tag)}
										<span class="rounded bg-[var(--gw-color-surface-2)] px-1.5 py-0.5 text-[11px] text-[var(--gw-color-text-muted)]">{tag}</span>
									{/each}
								</span>
							</td>
							<td class="px-2 py-1.5">
								<input
									class={inputCls}
									list="issue-types"
									value={row.issue_type}
									disabled={!canWrite}
									onchange={(e) => patch(row, 'issue_type', (e.currentTarget as HTMLInputElement).value)}
								/>
							</td>
							<td class="px-2 py-1.5">
								<select
									class={inputCls}
									value={String(row.priority)}
									disabled={!canWrite}
									onchange={(e) => patch(row, 'priority', (e.currentTarget as HTMLSelectElement).value)}
								>
									<option value="0">P0</option>
									<option value="1">P1</option>
									<option value="2">P2</option>
								</select>
							</td>
							<td class="px-2 py-1.5">
								<input
									class={inputCls}
									type="number" min="0" step="0.5"
									value={row.estimated_hours ?? ''}
									disabled={!canWrite}
									onchange={(e) => patch(row, 'estimated_hours', (e.currentTarget as HTMLInputElement).value)}
								/>
							</td>
							<td class="px-2 py-1.5">
								<AssigneeSelect
									class={inputCls}
									value={row.assignee ?? ''}
									users={data.users}
									disabled={!canWrite}
									onchange={(v) => patch(row, 'assignee', v)}
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
							{#if canWrite}
								<td class="px-2 py-1.5">
									<button
										class="rounded px-1.5 py-0.5 text-xs text-[var(--gw-color-text-muted)] hover:bg-[var(--gw-color-surface-2)] hover:text-[var(--gw-color-text)]"
										title={data.archived ? 'Restore' : 'Archive'}
										aria-label={data.archived ? `Restore ${row.id}` : `Archive ${row.id}`}
										onclick={() => toggleArchive(row)}
									>{data.archived ? '↩' : '🗄'}</button>
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	{:else}
		<p class="text-sm text-[var(--gw-color-text-muted)]">No tasks in this rig.</p>
	{/each}

	<footer class="flex justify-end rounded-xl border border-[var(--gw-color-border)] bg-[var(--gw-color-surface-2)] px-4 py-2 text-sm font-semibold">
		TOTAL HOURS: {totalHours} h
	</footer>
</div>

<!-- Shared type-category datalist: pick an existing category or type a new one. -->
<datalist id="issue-types">
	{#each typeOptions as t (t)}<option value={t}></option>{/each}
</datalist>

{#if selected}
	<CardDrawer
		card={selected}
		{canWrite}
		users={data.users}
		allIssues={rows}
		onClose={() => (selected = null)}
	/>
{/if}

{#if showCreate}
	<CreateIssueModal createdBy={data.user?.sub ?? 'gt-web'} onclose={() => (showCreate = false)} />
{/if}
