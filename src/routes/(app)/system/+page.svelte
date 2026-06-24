<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { hasScope } from '$lib/api/auth';
	import { browserSystem } from '$lib/api/system';
	import { browserDomain, type DomainCatalogEntry } from '$lib/api/domain';
	import { TrackerError } from '$lib/api/tracker';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const canWrite = $derived(hasScope(data.user?.scopes, 'system.write'));
	const canWriteDomain = $derived(hasScope(data.user?.scopes, 'domain.write'));

	let enabled = $state(data.config?.enabled ?? true);
	let archiveAfterDays = $state(data.config?.archive_after_days ?? 30);
	let intervalMinutes = $state(data.config?.interval_minutes ?? 60);

	let busy = $state(false);
	let message = $state('');
	let isError = $state(false);

	async function run(fn: () => Promise<unknown>, success: string) {
		busy = true;
		message = '';
		isError = false;
		try {
			await fn();
			message = success;
			await invalidateAll();
		} catch (err) {
			isError = true;
			message = err instanceof TrackerError ? `${err.status}: ${err.message}` : String(err);
		} finally {
			busy = false;
		}
	}

	function saveConfig() {
		run(
			() =>
				browserSystem().updateConfig({
					enabled,
					archive_after_days: archiveAfterDays,
					interval_minutes: intervalMinutes
				}),
			'Configuration saved.'
		);
	}

	function runNow() {
		run(async () => {
			const result = await browserSystem().runArchiveNow();
			message = `Archived ${result.archived} issue(s).`;
		}, '');
	}

	// ── Report digests (hq-25eb60, multi-schedule) ────────────────────────
	import type { ReportSchedule, ReportSchedulePatch } from '$lib/api/system';

	let newSubscriber = $state('');
	// Form state — null editingId = creating.
	let showForm = $state(false);
	let editingId = $state<string | null>(null);
	let fKind = $state('planning-digest');
	let fMode = $state<'daily' | 'every_n_days' | 'once' | 'weekly' | 'monthly'>('daily');
	let fNDays = $state(7);
	let fDate = $state('');
	let fWeekday = $state(1); // 0=domingo … 6=sábado
	let fDayOfMonth = $state(1); // 1..=31
	let fStart = $state(''); // optional YYYY-MM-DD gate for recurring modes
	let fHour = $state(8);
	let fMinute = $state(0);

	// Weekday labels for the weekly cadence selector (0=domingo … 6=sábado).
	const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

	// Two-way bridge between the native <input type="time"> (HH:MM string) and
	// the wire fields fHour/fMinute, so saveSchedule keeps sending hour/minute.
	const two = (n: number) => String(n).padStart(2, '0');
	let fTime = $state('08:00');
	$effect(() => {
		const [h, m] = fTime.split(':');
		const hh = Number(h);
		const mm = Number(m);
		if (Number.isFinite(hh)) fHour = hh;
		if (Number.isFinite(mm)) fMinute = mm;
	});
	let fRig = $state('hq');
	let fWorkspace = $state('default');
	let fEnabled = $state(true);
	let fSubscribers = $state('');

	// Real board scopes (hq-c697bb): selectors contrast against the distinct
	// (rig, workspace) pairs that actually have beads, not the catalog
	// cross-product. Catalog lists remain the fallback when scopes are empty.
	// `archive` is the manual-archive sink, never a report target (hq-1c7890).
	const ARCHIVE_WS = 'archive';
	function scopeWorkspaces(): string[] {
		// Union with the catalog so a real-but-empty workspace (no beads yet)
		// stays selectable (hq-1c7890).
		const real = (data.scopes ?? []).map((s) => s.workspace);
		return [...new Set([...real, ...(data.workspaces ?? [])])].filter(
			(w) => w !== ARCHIVE_WS
		);
	}
	function rigOptionsFor(ws: string): string[] {
		const scopes = data.scopes ?? [];
		// STRICT per-workspace (hq-59de0e): only rigs with a real board in the
		// selected workspace — never another workspace's rigs.
		if (scopes.length > 0) {
			const real = [...new Set(scopes.filter((s) => s.workspace === ws).map((s) => s.rig))];
			if (real.length > 0) return real;
			// No boards yet: the session workspace's own rig catalog (prefixes =
			// bead namespaces) is still a valid target — a freshly registered
			// rig has no beads but schedules may point at it (hq-5aae22). Other
			// workspaces' catalogs are unreadable by design (tenant data), so
			// they stay blocked.
			return ws === data.sessionWorkspace ? (data.rigs ?? []) : [];
		}
		// No scope data at all (old backend) ⇒ catalog fallback.
		return data.rigs ?? [];
	}
	/** Keep the rig valid for the workspace: reset to the first real option.
	 * A boardless workspace yields `''` — the control blocks and the backend's
	 * "rig is required" validation stops a save (hq-3650e8). */
	function defaultRigFor(ws: string, current?: string): string {
		const opts = rigOptionsFor(ws);
		if (current && opts.includes(current)) return current;
		if (opts.length > 0) return opts[0];
		return (data.scopes ?? []).length > 0 ? '' : (current ?? 'hq');
	}

	// Test report state
	let tKind = $state(data.reportKinds?.[0] ?? 'planning-digest');
	let tWorkspace = $state(scopeWorkspaces()[0] ?? 'default');
	let tRig = $state(
		data.activeRigPrefix && rigOptionsFor(tWorkspace).includes(data.activeRigPrefix)
			? data.activeRigPrefix
			: defaultRigFor(tWorkspace)
	);
	let tEmail = $state('');
	let testBusy = $state(false);
	let testMessage = $state('');
	let testError = $state(false);

	function openCreate() {
		editingId = null;
		fKind = data.reportKinds?.[0] ?? 'planning-digest';
		fMode = 'daily';
		fNDays = 7;
		fDate = '';
		fWeekday = 1;
		fDayOfMonth = 1;
		fStart = '';
		fTime = '08:00';
		fHour = 8;
		fMinute = 0;
		fWorkspace = scopeWorkspaces()[0] ?? 'default';
		fRig = defaultRigFor(fWorkspace);
		fEnabled = true;
		fSubscribers = '';
		showForm = true;
	}

	function openEdit(s: ReportSchedule) {
		editingId = s.id;
		fKind = s.kind;
		fMode = s.mode;
		fNDays = s.n_days;
		fDate = s.date ?? '';
		fWeekday = s.weekday ?? 1;
		fDayOfMonth = s.day_of_month ?? 1;
		fStart = s.start_date ?? '';
		fTime = `${two(s.hour)}:${two(s.minute)}`;
		fHour = s.hour;
		fMinute = s.minute;
		fRig = s.rig;
		fWorkspace = s.workspace;
		fEnabled = s.enabled;
		fSubscribers = (s.subscribers ?? []).join(', ');
		showForm = true;
	}

	function saveSchedule() {
		const patch: ReportSchedulePatch = {
			kind: fKind,
			mode: fMode,
			n_days: fNDays,
			date: fDate,
			weekday: fWeekday,
			day_of_month: fDayOfMonth,
			start_date: fStart,
			hour: fHour,
			minute: fMinute,
			rig: fRig,
			workspace: fWorkspace,
			enabled: fEnabled,
			subscribers: fSubscribers
				.split(',')
				.map((e) => e.trim())
				.filter((e) => e.length > 0)
		};
		run(async () => {
			if (editingId) await browserSystem().updateReportSchedule(editingId, patch);
			else await browserSystem().createReportSchedule(patch);
			showForm = false;
		}, editingId ? 'Schedule updated.' : 'Schedule created.');
	}

	function deleteSchedule(s: ReportSchedule) {
		run(() => browserSystem().deleteReportSchedule(s.id), 'Schedule deleted.');
	}

	function toggleSchedule(s: ReportSchedule, val: boolean) {
		run(
			() => browserSystem().updateReportSchedule(s.id, { enabled: val }),
			val ? 'Schedule enabled.' : 'Schedule disabled.'
		);
	}

	function runSchedule(s: ReportSchedule) {
		run(async () => {
			const result = await browserSystem().runReportSchedule(s.id);
			message = `Queued to ${result.queued} recipient(s).`;
		}, '');
	}

	async function sendTestReport() {
		testBusy = true;
		testMessage = '';
		testError = false;
		try {
			const api = browserSystem();
			const today = new Date().toISOString().slice(0, 10);
			const email = tEmail.trim();
			const s = await api.createReportSchedule({
				kind: tKind,
				mode: 'once',
				date: today,
				hour: 0,
				minute: 0,
				rig: tRig,
				workspace: tWorkspace,
				enabled: false,
				subscribers: email ? [email] : undefined
			});
			const result = await api.runReportSchedule(s.id);
			await api.deleteReportSchedule(s.id);
			testMessage = `Queued to ${result.queued} recipient(s).`;
		} catch (err) {
			testError = true;
			testMessage = err instanceof TrackerError ? `${err.status}: ${err.message}` : String(err);
		} finally {
			testBusy = false;
		}
	}

	function modeLabel(s: ReportSchedule): string {
		const at = `${two(s.hour)}:${two(s.minute)}`;
		if (s.mode === 'daily') return `daily at ${at}`;
		if (s.mode === 'every_n_days') return `every ${s.n_days} day(s) at ${at}`;
		if (s.mode === 'weekly')
			return `weekly on ${WEEKDAYS[s.weekday ?? 0] ?? '—'} at ${at}`;
		if (s.mode === 'monthly') return `monthly on day ${s.day_of_month ?? '—'} at ${at}`;
		return `on ${s.date ?? '—'} at ${at}`;
	}

	function addSubscriber() {
		const email = newSubscriber.trim();
		if (!email) return;
		run(async () => {
			await browserSystem().addReportSubscriber(email);
			newSubscriber = '';
		}, `Subscribed ${email}.`);
	}

	function removeSubscriber(email: string) {
		run(() => browserSystem().removeReportSubscriber(email), `Removed ${email}.`);
	}

	function toggleSubscriber(email: string, val: boolean) {
		run(
			() => browserSystem().toggleReportSubscriber(email, val),
			val ? `${email} will receive the digest.` : `${email} excluded from sends.`
		);
	}

	// ── Domain catalog (gtweb-855bac, UI half of H4) ──────────────────────
	// CRUD against /api/v1/domain (domain.read to view, domain.write to edit).
	// `meta.gap` is reserved: the backend rejects edit/delete, so the row locks
	// its controls. invalidateAll() re-runs the loader to refresh data.domains.
	let dNewKey = $state('');
	let dNewLabel = $state('');
	let dNewTier = $state('');
	// Inline rename: the key being edited (null = none) + its draft label.
	let dEditingKey = $state<string | null>(null);
	let dEditLabel = $state('');

	function addDomain() {
		const key = dNewKey.trim();
		if (!key) return;
		run(async () => {
			await browserDomain().add({
				key,
				label: dNewLabel.trim() || undefined,
				tier: dNewTier.trim() || undefined
			});
			dNewKey = '';
			dNewLabel = '';
			dNewTier = '';
		}, `Added domain ${key}.`);
	}

	function startEditDomain(d: DomainCatalogEntry) {
		dEditingKey = d.key;
		dEditLabel = d.label;
	}

	function cancelEditDomain() {
		dEditingKey = null;
		dEditLabel = '';
	}

	function saveDomainLabel(d: DomainCatalogEntry) {
		const label = dEditLabel.trim();
		run(async () => {
			await browserDomain().patch(d.key, { label: label || d.key });
			dEditingKey = null;
		}, `Renamed ${d.key}.`);
	}

	function toggleDomain(d: DomainCatalogEntry, enabled: boolean) {
		run(
			() => browserDomain().patch(d.key, { enabled }),
			enabled ? `Enabled ${d.key}.` : `Disabled ${d.key}.`
		);
	}

	function deleteDomain(d: DomainCatalogEntry) {
		run(() => browserDomain().remove(d.key), `Removed ${d.key}.`);
	}

	type Section = 'archive' | 'reports' | 'domains';
	let section = $state<Section>('archive');
</script>

<style>
	@keyframes fade-up-in {
		from { opacity: 0; transform: translateY(10px); }
		to   { opacity: 1; transform: translateY(0); }
	}
	.entry   { animation: fade-up-in 480ms cubic-bezier(0.32, 0.72, 0, 1) both; }
	.entry-1 { animation-delay: 0ms; }
	.entry-2 { animation-delay: 60ms; }
	.entry-3 { animation-delay: 120ms; }

	.bezel {
		border-radius: var(--gw-radius-2xl);
		border: 1px solid var(--gw-color-border-subtle);
		background-color: var(--gw-color-surface-3);
		padding: 3px;
	}
	.bezel-core {
		border-radius: calc(var(--gw-radius-2xl) - 3px);
		background-color: var(--gw-color-surface);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
	}

	/* Section tab strip */
	.tab-strip {
		display: flex;
		gap: 3px;
		border-radius: var(--gw-radius-xl);
		background-color: var(--gw-color-surface-3);
		border: 1px solid var(--gw-color-border-subtle);
		padding: 3px;
		width: fit-content;
	}
	.tab {
		border-radius: calc(var(--gw-radius-xl) - 3px);
		padding: var(--gw-space-2) var(--gw-space-4);
		font-size: var(--gw-text-xs);
		font-weight: 500;
		cursor: pointer;
		border: none;
		background: none;
		color: var(--gw-color-text-muted);
		transition: all 200ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.tab-active {
		background-color: var(--gw-color-primary);
		color: white;
		box-shadow: 0 2px 6px -1px oklch(60% 0.22 250 / 0.3);
	}

	/* Number input — compact, fixed width */
	.gw-input-num {
		width: 7rem;
		border-radius: var(--gw-radius-lg);
		border: 1px solid var(--gw-color-border);
		background-color: var(--gw-color-surface-3);
		color: var(--gw-color-text);
		font-size: var(--gw-text-sm);
		font-family: var(--gw-font-mono);
		padding: 0.4375rem 0.75rem;
		transition: border-color 160ms cubic-bezier(0.32, 0.72, 0, 1),
		            box-shadow   160ms cubic-bezier(0.32, 0.72, 0, 1);
		outline: none;
	}
	.gw-input-num:focus {
		border-color: var(--gw-color-primary);
		box-shadow: 0 0 0 3px oklch(60% 0.22 250 / 0.1);
	}
	.gw-input-num:disabled { opacity: 0.4; cursor: not-allowed; }

	/* Toggle checkbox */
	.gw-check {
		appearance: none;
		width: 1rem; height: 1rem;
		border-radius: var(--gw-radius-sm);
		border: 1px solid var(--gw-color-border);
		background-color: var(--gw-color-surface-3);
		cursor: pointer; flex-shrink: 0; position: relative;
		transition: border-color 140ms cubic-bezier(0.32, 0.72, 0, 1),
		            background-color 140ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.gw-check:checked {
		border-color: oklch(60% 0.22 250);
		background: linear-gradient(135deg, oklch(60% 0.22 250), oklch(50% 0.24 270));
	}
	.gw-check:checked::after {
		content: ''; position: absolute; left: 3px; top: 1px;
		width: 5px; height: 8px;
		border: 1.5px solid white; border-top: none; border-left: none;
		transform: rotate(45deg);
	}
	.gw-check:disabled { opacity: 0.4; cursor: not-allowed; }

	/* Cadence radio group */
	.gw-radio-group {
		display: flex; flex-wrap: wrap; gap: var(--gw-space-2);
	}
	.gw-radio {
		display: inline-flex; align-items: center; gap: var(--gw-space-2);
		border-radius: var(--gw-radius-lg);
		border: 1px solid var(--gw-color-border);
		background-color: var(--gw-color-surface-3);
		color: var(--gw-color-text);
		font-size: var(--gw-text-sm); font-weight: 500;
		padding: 0.4375rem 0.75rem; cursor: pointer;
		transition: border-color 150ms cubic-bezier(0.32, 0.72, 0, 1),
		            background-color 150ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.gw-radio:hover { border-color: var(--gw-color-primary); }
	.gw-radio:has(input:checked) {
		border-color: oklch(60% 0.22 250);
		background-color: oklch(60% 0.22 250 / 0.08);
	}
	.gw-radio input {
		appearance: none;
		width: 0.875rem; height: 0.875rem; border-radius: 9999px;
		border: 1px solid var(--gw-color-border);
		background-color: var(--gw-color-surface);
		cursor: pointer; flex-shrink: 0; position: relative;
		transition: border-color 140ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.gw-radio input:checked {
		border-color: oklch(60% 0.22 250);
	}
	.gw-radio input:checked::after {
		content: ''; position: absolute; left: 50%; top: 50%;
		width: 0.4375rem; height: 0.4375rem; border-radius: 9999px;
		transform: translate(-50%, -50%);
		background: linear-gradient(135deg, oklch(60% 0.22 250), oklch(50% 0.24 270));
	}
	.gw-radio input:focus-visible {
		outline: 2px solid var(--gw-color-primary); outline-offset: 2px;
	}
	.gw-radio:has(input:disabled) { opacity: 0.4; cursor: not-allowed; }

	/* CTA */
	.cta {
		display: inline-flex; align-items: center; gap: 0.5rem;
		border-radius: 9999px; border: none;
		background: linear-gradient(135deg, oklch(60% 0.22 250), oklch(50% 0.24 270));
		color: white; font-size: var(--gw-text-sm); font-weight: 600;
		padding: 0.5625rem 1.25rem; cursor: pointer;
		transition: opacity 200ms cubic-bezier(0.32, 0.72, 0, 1),
		            transform 200ms cubic-bezier(0.32, 0.72, 0, 1),
		            box-shadow 200ms cubic-bezier(0.32, 0.72, 0, 1);
		box-shadow: 0 4px 14px -2px oklch(60% 0.22 250 / 0.35);
	}
	.cta:hover:not(:disabled) { opacity: 0.92; box-shadow: 0 6px 20px -2px oklch(60% 0.22 250 / 0.45); }
	.cta:active:not(:disabled) { transform: scale(0.98); }
	.cta:disabled { opacity: 0.4; cursor: not-allowed; }
	.cta-arrow {
		display: inline-flex; align-items: center; justify-content: center;
		width: 1.5rem; height: 1.5rem; border-radius: 9999px;
		background-color: rgba(255, 255, 255, 0.18); font-size: 0.85rem;
		transition: transform 200ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.cta:hover:not(:disabled) .cta-arrow { transform: translateX(2px); }

	/* Ghost button */
	.btn-ghost {
		display: inline-flex; align-items: center; gap: 0.375rem;
		border-radius: 9999px; border: 1px solid var(--gw-color-border);
		background-color: var(--gw-color-surface-3); color: var(--gw-color-text);
		font-size: var(--gw-text-sm); font-weight: 500;
		padding: 0.5rem 1rem; cursor: pointer;
		transition: border-color 150ms cubic-bezier(0.32, 0.72, 0, 1),
		            background-color 150ms cubic-bezier(0.32, 0.72, 0, 1),
		            transform 150ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.btn-ghost:hover:not(:disabled) { border-color: var(--gw-color-primary); background-color: var(--gw-color-surface); }
	.btn-ghost:active:not(:disabled) { transform: scale(0.97); }
	.btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }

	/* Status badge */
	.badge-enabled {
		display: inline-flex; align-items: center; gap: 4px; border-radius: 9999px;
		background-color: oklch(96% 0.05 150); border: 1px solid oklch(85% 0.1 150);
		color: oklch(42% 0.16 150); font-size: 10px; font-weight: 600;
		padding: 2px 7px; text-transform: uppercase; letter-spacing: 0.06em;
	}
	.badge-disabled {
		display: inline-flex; align-items: center; border-radius: 9999px;
		background-color: var(--gw-color-surface-3); border: 1px solid var(--gw-color-border-subtle);
		color: var(--gw-color-text-muted); font-size: 10px; font-weight: 600;
		padding: 2px 7px; text-transform: uppercase; letter-spacing: 0.06em;
	}

	/* Config summary panel */
	.config-summary {
		border-radius: var(--gw-radius-xl);
		border: 1px solid var(--gw-color-border-subtle);
		background-color: var(--gw-color-surface-3);
		padding: var(--gw-space-3) var(--gw-space-4);
	}

	/* Warn callout */
	.warn-callout {
		border-radius: var(--gw-radius-lg);
		border: 1px solid oklch(88% 0.1 80); background-color: oklch(97% 0.04 80);
		color: oklch(48% 0.18 80); font-size: var(--gw-text-xs);
		padding: var(--gw-space-3) var(--gw-space-4);
	}

	.field-label {
		display: block; text-transform: uppercase; letter-spacing: 0.12em;
		font-size: 10px; font-weight: 600; color: var(--gw-color-text-muted);
		margin-bottom: var(--gw-space-1);
	}
	.field-divider {
		height: 1px; background-color: var(--gw-color-border-subtle);
	}
</style>

<div class="space-y-5">

	<!-- ── Header ──────────────────────────────────────────────────────────── -->
	<header class="entry entry-1 space-y-2">
		<span
			class="inline-flex items-center rounded-full border border-[var(--gw-color-border-subtle)]
				bg-[var(--gw-color-surface-3)] px-[var(--gw-space-3)] py-[3px]
				text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--gw-color-text-muted)]"
		>
			Admin
		</span>
		<h1
			class="text-[var(--gw-text-3xl)] font-semibold leading-[var(--gw-leading-tight)]
				tracking-tight text-[var(--gw-color-text)]"
		>
			System
		</h1>
		<p class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">
			Platform-level configuration. Changes take effect on the next daemon tick.
		</p>
	</header>

	<!-- ── Section tabs ────────────────────────────────────────────────────── -->
	<nav class="entry entry-2 tab-strip" aria-label="System sections">
		<button
			class="tab {section === 'archive' ? 'tab-active' : ''}"
			onclick={() => (section = 'archive')}
			aria-current={section === 'archive' ? 'page' : undefined}
		>
			Tracker Archive
		</button>
		<button
			class="tab {section === 'reports' ? 'tab-active' : ''}"
			onclick={() => (section = 'reports')}
			aria-current={section === 'reports' ? 'page' : undefined}
		>
			Email Reports
		</button>
		<button
			class="tab {section === 'domains' ? 'tab-active' : ''}"
			onclick={() => (section = 'domains')}
			aria-current={section === 'domains' ? 'page' : undefined}
		>
			Domains
		</button>
	</nav>

	<!-- ── Archive section ─────────────────────────────────────────────────── -->
	{#if section === 'archive'}
		<div class="entry entry-3 max-w-xl space-y-[var(--gw-space-4)]">

			<!-- Main card -->
			<div class="bezel">
				<div class="bezel-core px-[var(--gw-space-6)] py-[var(--gw-space-5)]">

					<!-- Card header -->
					<div class="mb-[var(--gw-space-4)] flex items-center justify-between gap-[var(--gw-space-4)]">
						<div class="flex items-center gap-[var(--gw-space-3)]">
							<div
								class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--gw-radius-lg)]
									border border-[var(--gw-color-border-subtle)] bg-[var(--gw-color-surface-3)]"
								aria-hidden="true"
							>
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
									stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
									style="color: var(--gw-color-text-muted)">
									<polyline points="21 8 21 21 3 21 3 8"/>
									<rect x="1" y="3" width="22" height="5" rx="1"/>
									<line x1="10" y1="12" x2="14" y2="12"/>
								</svg>
							</div>
							<h2 class="text-[var(--gw-text-base)] font-semibold text-[var(--gw-color-text)]">
								Archive Daemon
							</h2>
						</div>
						{#if enabled}
							<span class="badge-enabled">
								<span class="h-1.5 w-1.5 rounded-full bg-current"></span>
								Enabled
							</span>
						{:else}
							<span class="badge-disabled">Disabled</span>
						{/if}
					</div>

					<p class="mb-[var(--gw-space-4)] text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
						Closed issues older than the threshold are automatically archived and hidden from the
						default tracker view. The daemon runs on the configured interval.
					</p>

					{#if data.configError}
						<p class="warn-callout mb-[var(--gw-space-4)]">{data.configError}</p>
					{/if}

					<div class="field-divider mb-[var(--gw-space-4)]"></div>

					<!-- Settings form -->
					<form
						class="space-y-[var(--gw-space-4)]"
						onsubmit={(e) => { e.preventDefault(); saveConfig(); }}
					>
						<!-- Enable toggle -->
						<label class="flex cursor-pointer items-center gap-[var(--gw-space-2)]">
							<input
								type="checkbox"
								class="gw-check"
								bind:checked={enabled}
								disabled={!canWrite || busy}
							/>
							<span class="text-[var(--gw-text-sm)] text-[var(--gw-color-text)]">
								Enable automatic archival
							</span>
						</label>

						<!-- Numeric fields -->
						<div class="grid gap-[var(--gw-space-4)] sm:grid-cols-2">
							<div class="space-y-[var(--gw-space-1)]">
								<label for="archive-days" class="field-label">
									Archive after (days)
								</label>
								<input
									id="archive-days"
									class="gw-input-num"
									type="number"
									min="1"
									max="3650"
									bind:value={archiveAfterDays}
									disabled={!canWrite || busy}
								/>
							</div>
							<div class="space-y-[var(--gw-space-1)]">
								<label for="archive-interval" class="field-label">
									Sweep interval (minutes)
								</label>
								<input
									id="archive-interval"
									class="gw-input-num"
									type="number"
									min="1"
									max="10080"
									bind:value={intervalMinutes}
									disabled={!canWrite || busy}
								/>
							</div>
						</div>

						{#if canWrite}
							<div class="flex flex-wrap items-center gap-[var(--gw-space-2)]">
								<button type="submit" class="cta" disabled={busy}>
									{#if busy}
										<svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
											<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"/>
											<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
										</svg>
										<span>Saving…</span>
									{:else}
										<span>Save</span>
										<span class="cta-arrow" aria-hidden="true">→</span>
									{/if}
								</button>
								<button type="button" class="btn-ghost" disabled={busy} onclick={runNow}>
									Run now
								</button>
							</div>
						{/if}
					</form>

					<!-- Feedback -->
					{#if message}
						<p
							class="mt-[var(--gw-space-3)] text-[var(--gw-text-xs)]"
							style="color: {isError ? 'var(--gw-color-error)' : 'oklch(42% 0.16 150)'}"
						>
							{#if !isError}
								<svg class="mr-1 inline-block" width="11" height="11" viewBox="0 0 24 24"
									fill="none" stroke="currentColor" stroke-width="2.5"
									stroke-linecap="round" stroke-linejoin="round">
									<polyline points="20 6 9 17 4 12"/>
								</svg>
							{/if}
							{message}
						</p>
					{/if}

				</div>
			</div>

			<!-- Config summary (SSR snapshot) -->
			{#if data.config}
				<div class="config-summary space-y-[var(--gw-space-1)]">
					<p class="mb-[var(--gw-space-2)] text-[10px] font-semibold uppercase tracking-[0.12em]
						text-[var(--gw-color-text-muted)]">
						Current config
					</p>
					{#each [
						{ key: 'enabled', val: String(data.config.enabled) },
						{ key: 'archive_after_days', val: String(data.config.archive_after_days) },
						{ key: 'interval_minutes', val: String(data.config.interval_minutes) },
					] as row (row.key)}
						<div class="flex items-baseline gap-[var(--gw-space-2)]">
							<span class="font-[family-name:var(--gw-font-mono)] text-[10px]
								text-[var(--gw-color-text-muted)]">
								{row.key}
							</span>
							<span class="font-[family-name:var(--gw-font-mono)] text-[10px] font-semibold
								text-[var(--gw-color-text)]">
								{row.val}
							</span>
						</div>
					{/each}
				</div>
			{/if}

		</div>
	{/if}

	<!-- ── Email reports section (hq-25eb60, multi-schedule) ──────────────── -->
	{#if section === 'reports'}
		<div class="entry entry-3 max-w-2xl space-y-[var(--gw-space-4)]">

			<!-- Test report card -->
			<div class="bezel">
				<div class="bezel-core px-[var(--gw-space-6)] py-[var(--gw-space-5)]">

					<div class="mb-[var(--gw-space-4)] flex items-center gap-[var(--gw-space-3)]">
						<div
							class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--gw-radius-lg)]
								border border-[var(--gw-color-border-subtle)] bg-[var(--gw-color-surface-3)]"
							aria-hidden="true"
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
								stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
								style="color: var(--gw-color-text-muted)">
								<polygon points="5 3 19 12 5 21 5 3"/>
							</svg>
						</div>
						<h2 class="text-[var(--gw-text-base)] font-semibold text-[var(--gw-color-text)]">
							Send Test Report
						</h2>
					</div>

					<p class="mb-[var(--gw-space-4)] text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
						Fire a one-off report immediately — sent to the global subscriber list. Does not create
						a permanent schedule.
					</p>

					<div class="grid gap-[var(--gw-space-4)] sm:grid-cols-3">
						<div class="space-y-[var(--gw-space-1)]">
							<label for="test-kind" class="field-label">Report</label>
							{#if (data.reportKinds ?? []).length > 0}
								<select id="test-kind" class="gw-input-num" style="width: 100%"
									bind:value={tKind} disabled={testBusy || !canWrite}>
									{#each data.reportKinds ?? [] as k (k)}
										<option value={k}>{k}</option>
									{/each}
								</select>
							{:else}
								<input id="test-kind" class="gw-input-num" style="width: 100%" type="text"
									bind:value={tKind} disabled={testBusy || !canWrite} />
							{/if}
						</div>
						<div class="space-y-[var(--gw-space-1)]">
							<label for="test-rig" class="field-label">Rig</label>
							{#if rigOptionsFor(tWorkspace).length > 0}
								<select id="test-rig" class="gw-input-num" style="width: 100%"
									bind:value={tRig} disabled={testBusy || !canWrite}>
									{#each rigOptionsFor(tWorkspace) as r (r)}
										<option value={r}>{r}</option>
									{/each}
								</select>
							{:else if (data.scopes ?? []).length > 0}
								<input id="test-rig" class="gw-input-num" style="width: 100%" type="text"
									value="" placeholder="sin rigs en este workspace" disabled />
							{:else}
								<input id="test-rig" class="gw-input-num" style="width: 100%" type="text"
									bind:value={tRig} disabled={testBusy || !canWrite} />
							{/if}
						</div>
						<div class="space-y-[var(--gw-space-1)]">
							<label for="test-ws" class="field-label">Workspace</label>
							{#if scopeWorkspaces().length > 0}
								<select id="test-ws" class="gw-input-num" style="width: 100%"
									bind:value={tWorkspace} disabled={testBusy || !canWrite}
									onchange={() => (tRig = defaultRigFor(tWorkspace, tRig))}>
									{#each scopeWorkspaces() as w (w)}
										<option value={w}>{w}</option>
									{/each}
								</select>
							{:else}
								<input id="test-ws" class="gw-input-num" style="width: 100%" type="text"
									bind:value={tWorkspace} disabled={testBusy || !canWrite} />
							{/if}
						</div>
					</div>

					<div class="mt-[var(--gw-space-4)] space-y-[var(--gw-space-1)]">
						<label for="test-email" class="field-label">Send to</label>
						<input id="test-email" class="gw-input-num" style="width: 100%; max-width: 22rem"
							type="email" placeholder="email@domain.com (blank = global list)"
							bind:value={tEmail} disabled={testBusy || !canWrite} />
					</div>

					{#if canWrite}
						<div class="mt-[var(--gw-space-4)]">
							<button type="button" class="cta" disabled={testBusy} onclick={sendTestReport}>
								{#if testBusy}
									<svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"/>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
									</svg>
									<span>Sending…</span>
								{:else}
									<span>Send test</span>
									<span class="cta-arrow" aria-hidden="true">→</span>
								{/if}
							</button>
						</div>
					{/if}

					{#if testMessage}
						<p
							class="mt-[var(--gw-space-3)] text-[var(--gw-text-xs)]"
							style="color: {testError ? 'var(--gw-color-error)' : 'oklch(42% 0.16 150)'}"
						>
							{#if !testError}
								<svg class="mr-1 inline-block" width="11" height="11" viewBox="0 0 24 24"
									fill="none" stroke="currentColor" stroke-width="2.5"
									stroke-linecap="round" stroke-linejoin="round">
									<polyline points="20 6 9 17 4 12"/>
								</svg>
							{/if}
							{testMessage}
						</p>
					{/if}

				</div>
			</div>

			<!-- Schedules card -->
			<div class="bezel">
				<div class="bezel-core px-[var(--gw-space-6)] py-[var(--gw-space-5)]">

					<div class="mb-[var(--gw-space-4)] flex items-center justify-between gap-[var(--gw-space-4)]">
						<div class="flex items-center gap-[var(--gw-space-3)]">
							<div
								class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--gw-radius-lg)]
									border border-[var(--gw-color-border-subtle)] bg-[var(--gw-color-surface-3)]"
								aria-hidden="true"
							>
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
									stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
									style="color: var(--gw-color-text-muted)">
									<rect x="2" y="4" width="20" height="16" rx="2"/>
									<polyline points="22,6 12,13 2,6"/>
								</svg>
							</div>
							<h2 class="text-[var(--gw-text-base)] font-semibold text-[var(--gw-color-text)]">
								Report Schedules
							</h2>
						</div>
						{#if canWrite}
							<button type="button" class="btn-ghost" disabled={busy} onclick={openCreate}>
								+ New schedule
							</button>
						{/if}
					</div>

					<p class="mb-[var(--gw-space-4)] text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
						Each schedule emails one report (HTML) for its rig/workspace: daily, every N days,
						or once on a date (auto-disables after sending).
					</p>

					{#if data.reportError}
						<p class="warn-callout mb-[var(--gw-space-4)]">{data.reportError}</p>
					{/if}

					{#if data.reportSchedules && data.reportSchedules.length > 0}
						<div class="space-y-[var(--gw-space-1)]">
							{#each data.reportSchedules as s (s.id)}
								<div class="flex flex-wrap items-center justify-between gap-[var(--gw-space-2)]
									rounded-[var(--gw-radius-lg)] border border-[var(--gw-color-border-subtle)]
									bg-[var(--gw-color-surface-3)] px-[var(--gw-space-3)] py-[var(--gw-space-2)]">
									<label class="flex min-w-0 cursor-pointer items-center gap-[var(--gw-space-2)]">
										<input
											type="checkbox"
											class="gw-check"
											checked={s.enabled}
											disabled={!canWrite || busy}
											onchange={(e) => toggleSchedule(s, e.currentTarget.checked)}
										/>
										<span class="min-w-0" class:opacity-50={!s.enabled}>
											<span class="block truncate text-[var(--gw-text-xs)] font-semibold
												text-[var(--gw-color-text)]">
												{s.kind} · {s.rig}/{s.workspace}
											</span>
											<span class="block text-[10px] text-[var(--gw-color-text-muted)]">
												{modeLabel(s)}
												{#if s.last_sent_date} · last: {s.last_sent_date}{/if}
												{#if s.subscribers} · {s.subscribers.length} custom recipient(s){/if}
											</span>
										</span>
									</label>
									{#if canWrite}
										<div class="flex items-center gap-[var(--gw-space-1)]">
											<button type="button" class="btn-ghost"
												style="padding: 0.25rem 0.625rem; font-size: 11px"
												disabled={busy} onclick={() => runSchedule(s)}>
												Send now
											</button>
											<button type="button" class="btn-ghost"
												style="padding: 0.25rem 0.625rem; font-size: 11px"
												disabled={busy} onclick={() => openEdit(s)}>
												Edit
											</button>
											<button type="button" class="btn-ghost"
												style="padding: 0.25rem 0.625rem; font-size: 11px"
												disabled={busy} onclick={() => deleteSchedule(s)}>
												Delete
											</button>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{:else if !data.reportError}
						<p class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
							No schedules yet.
						</p>
					{/if}

					{#if showForm && canWrite}
						<div class="field-divider my-[var(--gw-space-4)]"></div>
						<form
							class="space-y-[var(--gw-space-4)]"
							onsubmit={(e) => { e.preventDefault(); saveSchedule(); }}
						>
							<p class="text-[var(--gw-text-xs)] font-semibold text-[var(--gw-color-text)]">
								{editingId ? 'Edit schedule' : 'New schedule'}
							</p>
							<div class="grid gap-[var(--gw-space-4)] sm:grid-cols-2">
								<div class="space-y-[var(--gw-space-1)]">
									<label for="sch-kind" class="field-label">Report</label>
									<select id="sch-kind" class="gw-input-num" style="width: 100%"
										bind:value={fKind} disabled={busy}>
										{#each data.reportKinds ?? [] as k (k)}
											<option value={k}>{k}</option>
										{/each}
									</select>
								</div>
								<div class="space-y-[var(--gw-space-1)] sm:col-span-2">
									<span class="field-label">Cadencia</span>
									<div class="gw-radio-group" role="radiogroup" aria-label="Cadencia">
										<label class="gw-radio">
											<input type="radio" name="sch-mode" value="daily"
												bind:group={fMode} disabled={busy} />
											<span>Diariamente</span>
										</label>
										<label class="gw-radio">
											<input type="radio" name="sch-mode" value="weekly"
												bind:group={fMode} disabled={busy} />
											<span>Semanalmente</span>
										</label>
										<label class="gw-radio">
											<input type="radio" name="sch-mode" value="monthly"
												bind:group={fMode} disabled={busy} />
											<span>Mensualmente</span>
										</label>
										<label class="gw-radio">
											<input type="radio" name="sch-mode" value="once"
												bind:group={fMode} disabled={busy} />
											<span>Una vez</span>
										</label>
										<label class="gw-radio">
											<input type="radio" name="sch-mode" value="every_n_days"
												bind:group={fMode} disabled={busy} />
											<span>Cada N días</span>
										</label>
									</div>
								</div>
								{#if fMode === 'every_n_days'}
									<div class="space-y-[var(--gw-space-1)]">
										<label for="sch-ndays" class="field-label">Every (days)</label>
										<input id="sch-ndays" class="gw-input-num" type="number" min="1" max="365"
											bind:value={fNDays} disabled={busy} />
									</div>
								{/if}
								{#if fMode === 'weekly'}
									<div class="space-y-[var(--gw-space-1)]">
										<label for="sch-weekday" class="field-label">Día de la semana</label>
										<select id="sch-weekday" class="gw-input-num" style="width: 100%"
											bind:value={fWeekday} disabled={busy}>
											{#each WEEKDAYS as day, i (i)}
												<option value={i}>{day}</option>
											{/each}
										</select>
									</div>
								{/if}
								{#if fMode === 'monthly'}
									<div class="space-y-[var(--gw-space-1)]">
										<label for="sch-dom" class="field-label">Día del mes (1–31)</label>
										<input id="sch-dom" class="gw-input-num" type="number" min="1" max="31"
											bind:value={fDayOfMonth} disabled={busy} />
									</div>
								{/if}
								{#if fMode === 'once'}
									<div class="space-y-[var(--gw-space-1)]">
										<label for="sch-date" class="field-label">Date</label>
										<input id="sch-date" class="gw-input-num" type="date"
											bind:value={fDate} disabled={busy} />
									</div>
								{/if}
								{#if fMode !== 'once'}
									<div class="space-y-[var(--gw-space-1)]">
										<label for="sch-start" class="field-label">Inicio (opcional)</label>
										<input id="sch-start" class="gw-input-num" type="date"
											bind:value={fStart} disabled={busy} />
									</div>
								{/if}
								<div class="space-y-[var(--gw-space-1)]">
									<label for="sch-time" class="field-label">Hora</label>
									<input id="sch-time" class="gw-input-num" type="time"
										bind:value={fTime} disabled={busy} />
								</div>
								<div class="space-y-[var(--gw-space-1)]">
									<label for="sch-rig" class="field-label">Rig</label>
									{#if rigOptionsFor(fWorkspace).length > 0}
										<select id="sch-rig" class="gw-input-num" style="width: 100%"
											bind:value={fRig} disabled={busy}>
											{#each rigOptionsFor(fWorkspace) as r (r)}
												<option value={r}>{r}</option>
											{/each}
										</select>
									{:else if (data.scopes ?? []).length > 0}
										<input id="sch-rig" class="gw-input-num" type="text"
											value="" placeholder="sin rigs en este workspace" disabled />
									{:else}
										<input id="sch-rig" class="gw-input-num" type="text"
											bind:value={fRig} disabled={busy} />
									{/if}
								</div>
								<div class="space-y-[var(--gw-space-1)]">
									<label for="sch-ws" class="field-label">Workspace</label>
									{#if scopeWorkspaces().length > 0}
										<select id="sch-ws" class="gw-input-num" style="width: 100%"
											bind:value={fWorkspace} disabled={busy}
												onchange={() => (fRig = defaultRigFor(fWorkspace, fRig))}>
											{#each scopeWorkspaces() as w (w)}
												<option value={w}>{w}</option>
											{/each}
										</select>
									{:else}
										<input id="sch-ws" class="gw-input-num" type="text"
											bind:value={fWorkspace} disabled={busy} />
									{/if}
								</div>
							</div>
							<div class="space-y-[var(--gw-space-1)]">
								<label for="sch-subs" class="field-label">
									Per-schedule recipients (comma-separated; blank = global list)
								</label>
								<input id="sch-subs" class="gw-input-num" style="width: 100%" type="text"
									placeholder="ana@x.com, bob@x.com"
									bind:value={fSubscribers} disabled={busy} />
							</div>
							<label class="flex cursor-pointer items-center gap-[var(--gw-space-2)]">
								<input type="checkbox" class="gw-check" bind:checked={fEnabled} disabled={busy} />
								<span class="text-[var(--gw-text-sm)] text-[var(--gw-color-text)]">Enabled</span>
							</label>
							<div class="flex flex-wrap items-center gap-[var(--gw-space-2)]">
								<button type="submit" class="cta" disabled={busy}>
									<span>{editingId ? 'Save' : 'Create'}</span>
									<span class="cta-arrow" aria-hidden="true">→</span>
								</button>
								<button type="button" class="btn-ghost" disabled={busy}
									onclick={() => (showForm = false)}>
									Cancel
								</button>
							</div>
						</form>
					{/if}

					{#if message}
						<p
							class="mt-[var(--gw-space-3)] text-[var(--gw-text-xs)]"
							style="color: {isError ? 'var(--gw-color-error)' : 'oklch(42% 0.16 150)'}"
						>
							{message}
						</p>
					{/if}

				</div>
			</div>

			<!-- Subscribers card -->
			<div class="bezel">
				<div class="bezel-core px-[var(--gw-space-6)] py-[var(--gw-space-5)]">

					<h2 class="mb-[var(--gw-space-1)] text-[var(--gw-text-base)] font-semibold text-[var(--gw-color-text)]">
						Global Subscribers
					</h2>
					<p class="mb-[var(--gw-space-4)] text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
						Fallback list for schedules with no per-schedule recipients. Uncheck to exclude from
						sends without removing.
					</p>

					{#if canWrite}
						<form
							class="mb-[var(--gw-space-4)] flex items-center gap-[var(--gw-space-2)]"
							onsubmit={(e) => { e.preventDefault(); addSubscriber(); }}
						>
							<input
								class="gw-input-num"
								style="width: 16rem"
								type="email"
								placeholder="email@domain.com"
								bind:value={newSubscriber}
								disabled={busy}
							/>
							<button type="submit" class="btn-ghost" disabled={busy || !newSubscriber.trim()}>
								Add
							</button>
						</form>
					{/if}

					{#if data.reportSubscribers && data.reportSubscribers.length > 0}
						<div class="space-y-[var(--gw-space-1)]">
							{#each data.reportSubscribers as sub (sub.id)}
								<div class="flex items-center justify-between gap-[var(--gw-space-2)] rounded-[var(--gw-radius-lg)]
									border border-[var(--gw-color-border-subtle)] bg-[var(--gw-color-surface-3)]
									px-[var(--gw-space-3)] py-[var(--gw-space-2)]">
									<label class="flex min-w-0 cursor-pointer items-center gap-[var(--gw-space-2)]">
										<input
											type="checkbox"
											class="gw-check"
											checked={sub.enabled}
											disabled={!canWrite || busy}
											onchange={(e) => toggleSubscriber(sub.email, e.currentTarget.checked)}
										/>
										<span class="truncate font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)]
											text-[var(--gw-color-text)]" class:opacity-50={!sub.enabled}>
											{sub.email}
										</span>
									</label>
									{#if canWrite}
										<button
											type="button"
											class="btn-ghost"
											style="padding: 0.25rem 0.625rem; font-size: 11px"
											disabled={busy}
											onclick={() => removeSubscriber(sub.email)}
										>
											Remove
										</button>
									{/if}
								</div>
							{/each}
						</div>
					{:else if !data.reportError}
						<p class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
							No subscribers yet.
						</p>
					{/if}

				</div>
			</div>

		</div>
	{/if}

	<!-- ── Domains section (gtweb-855bac, UI half of H4) ──────────────────── -->
	{#if section === 'domains'}
		<div class="entry entry-3 max-w-2xl space-y-[var(--gw-space-4)]">

			<!-- Catalog card -->
			<div class="bezel">
				<div class="bezel-core px-[var(--gw-space-6)] py-[var(--gw-space-5)]">

					<div class="mb-[var(--gw-space-4)] flex items-center gap-[var(--gw-space-3)]">
						<div
							class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--gw-radius-lg)]
								border border-[var(--gw-color-border-subtle)] bg-[var(--gw-color-surface-3)]"
							aria-hidden="true"
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
								stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
								style="color: var(--gw-color-text-muted)">
								<path d="M3 7h18M3 12h18M3 17h18"/>
							</svg>
						</div>
						<h2 class="text-[var(--gw-text-base)] font-semibold text-[var(--gw-color-text)]">
							Domain Catalog
						</h2>
					</div>

					<p class="mb-[var(--gw-space-4)] text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
						The semantic domains beads in this workspace may carry. Add, rename or disable them —
						the New-bead selector lists the enabled ones. <code>meta.gap</code> is reserved by the
						platform and can't be edited or removed.
					</p>

					{#if data.domainError}
						<p class="warn-callout mb-[var(--gw-space-4)]">{data.domainError}</p>
					{:else if data.domains === null}
						<p class="warn-callout mb-[var(--gw-space-4)]">
							Requires <code>domain.read</code> to view the catalog.
						</p>
					{/if}

					{#if data.domains && data.domains.length > 0}
						<div class="space-y-[var(--gw-space-1)]">
							{#each data.domains as d (d.key)}
								<div class="flex flex-wrap items-center justify-between gap-[var(--gw-space-2)]
									rounded-[var(--gw-radius-lg)] border border-[var(--gw-color-border-subtle)]
									bg-[var(--gw-color-surface-3)] px-[var(--gw-space-3)] py-[var(--gw-space-2)]">
									<label class="flex min-w-0 items-center gap-[var(--gw-space-2)]"
										class:cursor-pointer={canWriteDomain && !d.reserved}>
										<input
											type="checkbox"
											class="gw-check"
											checked={d.enabled}
											disabled={!canWriteDomain || d.reserved || busy}
											onchange={(e) => toggleDomain(d, e.currentTarget.checked)}
										/>
										<span class="min-w-0" class:opacity-50={!d.enabled}>
											{#if dEditingKey === d.key}
												<input
													class="gw-input-num"
													style="width: 14rem"
													bind:value={dEditLabel}
													disabled={busy}
													aria-label="New label for {d.key}"
												/>
											{:else}
												<span class="block truncate text-[var(--gw-text-xs)] font-semibold
													text-[var(--gw-color-text)]">
													{d.label}
												</span>
												<span class="block font-[family-name:var(--gw-font-mono)] text-[10px]
													text-[var(--gw-color-text-muted)]">
													{d.key}{#if d.tier} · {d.tier}{/if}
												</span>
											{/if}
										</span>
									</label>
									<div class="flex items-center gap-[var(--gw-space-1)]">
										{#if d.reserved}
											<span class="badge-disabled">Reserved</span>
										{:else if !d.enabled}
											<span class="badge-disabled">Disabled</span>
										{/if}
										{#if canWriteDomain && !d.reserved}
											{#if dEditingKey === d.key}
												<button type="button" class="btn-ghost"
													style="padding: 0.25rem 0.625rem; font-size: 11px"
													disabled={busy} onclick={() => saveDomainLabel(d)}>
													Save
												</button>
												<button type="button" class="btn-ghost"
													style="padding: 0.25rem 0.625rem; font-size: 11px"
													disabled={busy} onclick={cancelEditDomain}>
													Cancel
												</button>
											{:else}
												<button type="button" class="btn-ghost"
													style="padding: 0.25rem 0.625rem; font-size: 11px"
													disabled={busy} onclick={() => startEditDomain(d)}>
													Rename
												</button>
												<button type="button" class="btn-ghost"
													style="padding: 0.25rem 0.625rem; font-size: 11px"
													disabled={busy} onclick={() => deleteDomain(d)}>
													Delete
												</button>
											{/if}
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{:else if data.domains && data.domains.length === 0 && !data.domainError}
						<p class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
							No domains in this workspace's catalog yet.
						</p>
					{/if}

					{#if canWriteDomain}
						<div class="field-divider my-[var(--gw-space-4)]"></div>
						<form
							class="space-y-[var(--gw-space-4)]"
							onsubmit={(e) => { e.preventDefault(); addDomain(); }}
						>
							<p class="text-[var(--gw-text-xs)] font-semibold text-[var(--gw-color-text)]">
								Add domain
							</p>
							<div class="grid gap-[var(--gw-space-4)] sm:grid-cols-3">
								<div class="space-y-[var(--gw-space-1)]">
									<label for="dom-key" class="field-label">Key</label>
									<input id="dom-key" class="gw-input-num" style="width: 100%" type="text"
										placeholder="producto" bind:value={dNewKey} disabled={busy} required />
								</div>
								<div class="space-y-[var(--gw-space-1)]">
									<label for="dom-label" class="field-label">Label (optional)</label>
									<input id="dom-label" class="gw-input-num" style="width: 100%" type="text"
										placeholder="Producto" bind:value={dNewLabel} disabled={busy} />
								</div>
								<div class="space-y-[var(--gw-space-1)]">
									<label for="dom-tier" class="field-label">Tier (optional)</label>
									<input id="dom-tier" class="gw-input-num" style="width: 100%" type="text"
										placeholder="negocio" bind:value={dNewTier} disabled={busy} />
								</div>
							</div>
							<button type="submit" class="cta" disabled={busy || !dNewKey.trim()}>
								<span>Add</span>
								<span class="cta-arrow" aria-hidden="true">→</span>
							</button>
						</form>
					{/if}

					{#if message}
						<p
							class="mt-[var(--gw-space-3)] text-[var(--gw-text-xs)]"
							style="color: {isError ? 'var(--gw-color-error)' : 'oklch(42% 0.16 150)'}"
						>
							{message}
						</p>
					{/if}

				</div>
			</div>

		</div>
	{/if}

</div>
