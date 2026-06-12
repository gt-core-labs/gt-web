<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { hasScope } from '$lib/api/auth';
	import { browserSystem } from '$lib/api/system';
	import { TrackerError } from '$lib/api/tracker';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const canWrite = $derived(hasScope(data.user?.scopes, 'system.write'));

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
	let fMode = $state<'daily' | 'every_n_days' | 'once'>('daily');
	let fNDays = $state(7);
	let fDate = $state('');
	let fHour = $state(8);
	let fMinute = $state(0);
	let fRig = $state('hq');
	let fWorkspace = $state('default');
	let fEnabled = $state(true);
	let fSubscribers = $state('');

	function openCreate() {
		editingId = null;
		fKind = data.reportKinds?.[0] ?? 'planning-digest';
		fMode = 'daily';
		fNDays = 7;
		fDate = '';
		fHour = 8;
		fMinute = 0;
		fRig = 'hq';
		fWorkspace = 'default';
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

	function toggleSchedule(s: ReportSchedule, enabled: boolean) {
		run(
			() => browserSystem().updateReportSchedule(s.id, { enabled }),
			enabled ? 'Schedule enabled.' : 'Schedule disabled.'
		);
	}

	function runSchedule(s: ReportSchedule) {
		run(async () => {
			const result = await browserSystem().runReportSchedule(s.id);
			message = `Queued to ${result.queued} recipient(s).`;
		}, '');
	}

	const two = (n: number) => String(n).padStart(2, '0');
	function modeLabel(s: ReportSchedule): string {
		const at = `${two(s.hour)}:${two(s.minute)}`;
		if (s.mode === 'daily') return `diario ${at}`;
		if (s.mode === 'every_n_days') return `cada ${s.n_days} día(s) ${at}`;
		return `el ${s.date ?? '—'} ${at}`;
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

	function toggleSubscriber(email: string, enabled: boolean) {
		run(
			() => browserSystem().toggleReportSubscriber(email, enabled),
			enabled ? `${email} will receive the digest.` : `${email} excluded from sends.`
		);
	}

	type Section = 'archive' | 'reports';
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
												{#if s.last_sent_date} · último: {s.last_sent_date}{/if}
												{#if s.subscribers} · {s.subscribers.length} destinatario(s) propios{/if}
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
								<div class="space-y-[var(--gw-space-1)]">
									<label for="sch-mode" class="field-label">Mode</label>
									<select id="sch-mode" class="gw-input-num" style="width: 100%"
										bind:value={fMode} disabled={busy}>
										<option value="daily">Diario</option>
										<option value="every_n_days">Cada N días</option>
										<option value="once">Fecha única</option>
									</select>
								</div>
								{#if fMode === 'every_n_days'}
									<div class="space-y-[var(--gw-space-1)]">
										<label for="sch-ndays" class="field-label">Cada (días)</label>
										<input id="sch-ndays" class="gw-input-num" type="number" min="1" max="365"
											bind:value={fNDays} disabled={busy} />
									</div>
								{/if}
								{#if fMode === 'once'}
									<div class="space-y-[var(--gw-space-1)]">
										<label for="sch-date" class="field-label">Fecha</label>
										<input id="sch-date" class="gw-input-num" type="date"
											bind:value={fDate} disabled={busy} />
									</div>
								{/if}
								<div class="space-y-[var(--gw-space-1)]">
									<label for="sch-hour" class="field-label">Hour (0–23)</label>
									<input id="sch-hour" class="gw-input-num" type="number" min="0" max="23"
										bind:value={fHour} disabled={busy} />
								</div>
								<div class="space-y-[var(--gw-space-1)]">
									<label for="sch-minute" class="field-label">Minute (0–59)</label>
									<input id="sch-minute" class="gw-input-num" type="number" min="0" max="59"
										bind:value={fMinute} disabled={busy} />
								</div>
								<div class="space-y-[var(--gw-space-1)]">
									<label for="sch-rig" class="field-label">Rig</label>
									<input id="sch-rig" class="gw-input-num" type="text"
										bind:value={fRig} disabled={busy} />
								</div>
								<div class="space-y-[var(--gw-space-1)]">
									<label for="sch-ws" class="field-label">Workspace</label>
									<input id="sch-ws" class="gw-input-num" type="text"
										bind:value={fWorkspace} disabled={busy} />
								</div>
							</div>
							<div class="space-y-[var(--gw-space-1)]">
								<label for="sch-subs" class="field-label">
									Destinatarios propios (coma-separados; vacío = lista global)
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
						Subscribers
					</h2>
					<p class="mb-[var(--gw-space-4)] text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
						The checkbox selects who receives: unchecked subscribers stay listed but are excluded
						from sends.
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
								placeholder="correo@dominio.com"
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

</div>
