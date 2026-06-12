<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { browserAdmin, type QuotaWindow } from '$lib/api/admin';
	import { hasScope } from '$lib/api/auth';
	import { TrackerError } from '$lib/api/tracker';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const canWrite = $derived(hasScope(data.user?.scopes, 'quota.write'));
	let saving = $state(false);

	const enhancer = () => {
		saving = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			saving = false;
		};
	};

	type Step = 'idle' | 'starting' | 'await' | 'completing';
	let step = $state<Step>('idle');
	let loginUrl = $state('');
	let sessionId = $state('');
	let code = $state('');
	let onboardErr = $state('');
	let copied = $state(false);
	const api = browserAdmin();

	const errText = (e: unknown) =>
		e instanceof TrackerError ? `${e.status}: ${e.message}` : String(e);

	async function startOnboard() {
		onboardErr = '';
		step = 'starting';
		try {
			const { session_id, url } = await api.onboardStart();
			sessionId = session_id;
			loginUrl = url;
			step = 'await';
		} catch (e) {
			onboardErr = errText(e);
			step = 'idle';
		}
	}

	async function completeOnboard() {
		if (!code.trim()) { onboardErr = 'Paste the code from the login page.'; return; }
		onboardErr = '';
		step = 'completing';
		try {
			await api.onboardComplete(sessionId, code.trim());
			cancelOnboard();
			await invalidateAll();
		} catch (e) {
			onboardErr = errText(e);
			step = 'await';
		}
	}

	function cancelOnboard() {
		step = 'idle'; loginUrl = ''; sessionId = ''; code = ''; onboardErr = ''; copied = false;
	}

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(loginUrl);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			onboardErr = 'Could not copy — select the link and copy manually.';
		}
	}

	const pct = (w: { consumed: number; limit: number }) =>
		w.limit > 0 ? Math.min(100, Math.round((w.consumed / w.limit) * 100)) : 0;
	const fmtTime = (secs: number) => new Date(secs * 1000).toLocaleString();

	// ── Status-change notifications ──────────────────────────────────────────
	type ToastNotif = { id: string; message: string; level: 'success' | 'warn' };
	let notifications = $state<ToastNotif[]>([]);

	const NOTIF_KEY   = 'gt_quota_notifs_v1';
	const STATUS_KEY  = 'gt_quota_statuses_v1';

	function dismissNotif(id: string) {
		notifications = notifications.filter(n => n.id !== id);
		try {
			const stored: ToastNotif[] = JSON.parse(localStorage.getItem(NOTIF_KEY) ?? '[]');
			localStorage.setItem(NOTIF_KEY, JSON.stringify(stored.filter(n => n.id !== id)));
		} catch { /* ignore */ }
	}

	$effect(() => {
		if (typeof localStorage === 'undefined') return;
		try {
			const prev: Record<string, string> = JSON.parse(localStorage.getItem(STATUS_KEY) ?? '{}');
			const curr: Record<string, string> = {};
			const fresh: ToastNotif[] = [];

			for (const acct of data.accounts) {
				curr[acct.id] = acct.status;
				const was = prev[acct.id];
				if (was && was !== acct.status) {
					const activated = acct.status === 'Healthy';
					fresh.push({
						id: `${acct.id}:${was}→${acct.status}`,
						message: activated
							? `${acct.id} — cuenta reactivada (${was} → Healthy)`
							: `${acct.id} — cuenta desactivada (${was} → ${acct.status})`,
						level: activated ? 'success' : 'warn',
					});
				}
			}
			localStorage.setItem(STATUS_KEY, JSON.stringify(curr));

			const stored: ToastNotif[] = JSON.parse(localStorage.getItem(NOTIF_KEY) ?? '[]');
			const seen = new Set(stored.map(n => n.id));
			const merged = [...stored, ...fresh.filter(n => !seen.has(n.id))];
			if (fresh.some(n => !seen.has(n.id))) {
				localStorage.setItem(NOTIF_KEY, JSON.stringify(merged));
			}
			notifications = merged;
		} catch { /* localStorage unavailable */ }
	});

	// ── Live countdown ───────────────────────────────────────────────────────
	let nowSecs = $state(Math.floor(Date.now() / 1000));
	$effect(() => {
		const t = setInterval(() => { nowSecs = Math.floor(Date.now() / 1000); }, 30_000);
		return () => clearInterval(t);
	});

	function activatesIn(acct: { status: string; window: QuotaWindow | null; weekly_window?: QuotaWindow | null }): string | null {
		if (acct.status === 'Healthy') return null;
		const w = acct.window ?? acct.weekly_window ?? null;
		if (!w) return null;
		const rem = w.resets_at_secs - nowSecs;
		if (rem <= 0) return 'pronto';
		const h = Math.floor(rem / 3600);
		const m = Math.floor((rem % 3600) / 60);
		if (h > 0) return `${h}h ${m}m`;
		return m > 0 ? `${m}m` : '<1m';
	}
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
	.bezel-core-overflow {
		border-radius: calc(var(--gw-radius-2xl) - 3px);
		background-color: var(--gw-color-surface);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
		overflow: hidden;
	}

	.gw-input {
		display: block;
		width: 100%;
		border-radius: var(--gw-radius-lg);
		border: 1px solid var(--gw-color-border);
		background-color: var(--gw-color-surface-3);
		color: var(--gw-color-text);
		font-size: var(--gw-text-sm);
		padding: 0.5rem 0.75rem;
		transition: border-color 160ms cubic-bezier(0.32, 0.72, 0, 1),
		            box-shadow   160ms cubic-bezier(0.32, 0.72, 0, 1);
		outline: none;
	}
	.gw-input:focus {
		border-color: var(--gw-color-primary);
		box-shadow: 0 0 0 3px oklch(60% 0.22 250 / 0.1);
	}
	.gw-input::placeholder { color: var(--gw-color-text-muted); opacity: 0.55; }
	.gw-input:disabled { opacity: 0.45; cursor: not-allowed; }

	/* Primary CTA */
	.cta {
		display: inline-flex; align-items: center; gap: 0.5rem;
		border-radius: 9999px; border: none;
		background: linear-gradient(135deg, oklch(60% 0.22 250), oklch(50% 0.24 270));
		color: white; font-size: var(--gw-text-sm); font-weight: 600;
		padding: 0.5625rem 1.25rem; cursor: pointer; white-space: nowrap;
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
		font-size: var(--gw-text-xs); font-weight: 500;
		padding: 0.375rem 0.875rem; cursor: pointer; white-space: nowrap;
		transition: border-color 150ms cubic-bezier(0.32, 0.72, 0, 1),
		            background-color 150ms cubic-bezier(0.32, 0.72, 0, 1),
		            transform 150ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.btn-ghost:hover:not(:disabled) { border-color: var(--gw-color-primary); background-color: var(--gw-color-surface); }
	.btn-ghost:active:not(:disabled) { transform: scale(0.97); }
	.btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }

	/* Danger ghost */
	.btn-danger {
		display: inline-flex; align-items: center;
		border-radius: 9999px; border: 1px solid var(--gw-color-border);
		background-color: var(--gw-color-surface-3); color: var(--gw-color-error);
		font-size: var(--gw-text-xs); font-weight: 500;
		padding: 0.3125rem 0.75rem; cursor: pointer; white-space: nowrap;
		transition: border-color 150ms cubic-bezier(0.32, 0.72, 0, 1),
		            background-color 150ms cubic-bezier(0.32, 0.72, 0, 1),
		            transform 150ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.btn-danger:hover:not(:disabled) { border-color: var(--gw-color-error); background-color: oklch(98% 0.015 25); }
	.btn-danger:active:not(:disabled) { transform: scale(0.97); }
	.btn-danger:disabled { opacity: 0.4; cursor: not-allowed; }

	/* Status badges */
	.badge-healthy {
		display: inline-flex; align-items: center; gap: 4px; border-radius: 9999px;
		background-color: oklch(96% 0.05 150); border: 1px solid oklch(85% 0.1 150);
		color: oklch(42% 0.16 150); font-size: 10px; font-weight: 600;
		padding: 2px 7px; text-transform: uppercase; letter-spacing: 0.06em;
	}
	.badge-warn {
		display: inline-flex; align-items: center; gap: 4px; border-radius: 9999px;
		background-color: oklch(97% 0.04 80); border: 1px solid oklch(88% 0.1 80);
		color: oklch(52% 0.18 80); font-size: 10px; font-weight: 600;
		padding: 2px 7px; text-transform: uppercase; letter-spacing: 0.06em;
	}

	/* Usage bar */
	.bar-track {
		height: 4px; border-radius: 9999px;
		background-color: var(--gw-color-surface-3); overflow: hidden; flex: 1; min-width: 60px;
	}
	.bar-fill {
		height: 100%; border-radius: 9999px;
		background-color: var(--gw-color-primary);
		transition: width 600ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.bar-fill-warn { background-color: var(--gw-color-warning); }
	.bar-fill-danger { background-color: var(--gw-color-error); }

	/* Onboard flow */
	.onboard-step {
		border-radius: var(--gw-radius-xl);
		border: 1px solid var(--gw-color-border-subtle);
		background-color: var(--gw-color-surface-3);
		padding: var(--gw-space-4);
	}
	.warn-callout {
		border-radius: var(--gw-radius-lg);
		border: 1px solid oklch(88% 0.1 80);
		background-color: oklch(97% 0.04 80);
		color: oklch(48% 0.18 80);
		font-size: var(--gw-text-xs);
		padding: var(--gw-space-3) var(--gw-space-4);
		line-height: 1.5;
	}
	.url-code {
		display: block; word-break: break-all;
		font-family: var(--gw-font-mono); font-size: var(--gw-text-xs);
		background-color: var(--gw-color-surface); border: 1px solid var(--gw-color-border-subtle);
		border-radius: var(--gw-radius-md); padding: 0.5rem 0.75rem;
		color: var(--gw-color-primary);
	}

	.data-row { transition: background-color 140ms cubic-bezier(0.32, 0.72, 0, 1); }
	.data-row:hover { background-color: var(--gw-color-surface-3); }

	/* Status-change notifications */
	.notif {
		display: flex; align-items: center; gap: var(--gw-space-3);
		border-radius: var(--gw-radius-lg); padding: var(--gw-space-3) var(--gw-space-4);
		font-size: var(--gw-text-xs);
		animation: fade-up-in 280ms cubic-bezier(0.32, 0.72, 0, 1) both;
	}
	.notif-success {
		background-color: oklch(96% 0.05 150); border: 1px solid oklch(85% 0.1 150);
		color: oklch(38% 0.16 150);
	}
	.notif-warn {
		background-color: oklch(97% 0.04 80); border: 1px solid oklch(88% 0.1 80);
		color: oklch(48% 0.18 80);
	}
	.notif-icon { flex-shrink: 0; display: flex; }
	.notif-msg  { flex: 1; font-weight: 500; line-height: 1.4; }
	.notif-dismiss {
		flex-shrink: 0; display: flex; align-items: center; justify-content: center;
		border: none; background: transparent; cursor: pointer; color: inherit;
		opacity: 0.55; padding: 2px; border-radius: 4px;
		transition: opacity 120ms;
	}
	.notif-dismiss:hover { opacity: 1; }
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
		<div class="flex items-baseline gap-[var(--gw-space-2)]">
			<h1
				class="text-[var(--gw-text-3xl)] font-semibold leading-[var(--gw-leading-tight)]
					tracking-tight text-[var(--gw-color-text)]"
			>
				Quota
			</h1>
			<span class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">
				{data.accounts.length}
			</span>
		</div>
	</header>

	<!-- ── Status-change notifications ─────────────────────────────────────── -->
	{#if notifications.length > 0}
		<div class="entry entry-1 space-y-2" role="status" aria-live="polite">
			{#each notifications as n (n.id)}
				<div class="notif {n.level === 'success' ? 'notif-success' : 'notif-warn'}">
					<span class="notif-icon">
						{#if n.level === 'success'}
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
								stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<polyline points="20 6 9 17 4 12"/>
							</svg>
						{:else}
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
								stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
								<line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
							</svg>
						{/if}
					</span>
					<span class="notif-msg">{n.message}</span>
					<button class="notif-dismiss" onclick={() => dismissNotif(n.id)} aria-label="Cerrar notificación">
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
							stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
						</svg>
					</button>
				</div>
			{/each}
		</div>
	{/if}

	<!-- ── Global feedback ─────────────────────────────────────────────────── -->
	{#if form?.error}
		<p class="entry entry-1 text-[var(--gw-text-xs)] text-[var(--gw-color-error)]">{form.error}</p>
	{/if}
	{#if form?.ok}
		<span class="entry entry-1 inline-flex items-center gap-[var(--gw-space-1)] text-[var(--gw-text-xs)]"
			style="color: oklch(42% 0.16 150)">
			<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
				stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="20 6 9 17 4 12"/>
			</svg>
			Done.
		</span>
	{/if}

	<!-- ── Add claude account (onboarding flow) ────────────────────────────── -->
	{#if canWrite}
		<section class="entry entry-2 bezel" aria-label="Add claude account">
			<div class="bezel-core px-[var(--gw-space-6)] py-[var(--gw-space-5)]">

				<!-- Section header -->
				<div class="flex items-center justify-between gap-[var(--gw-space-4)]">
					<div class="flex items-center gap-[var(--gw-space-3)]">
						<div
							class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--gw-radius-lg)]
								border border-[var(--gw-color-border-subtle)] bg-[var(--gw-color-surface-3)]"
							aria-hidden="true"
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
								stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
								style="color: var(--gw-color-text-muted)">
								<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
								<circle cx="12" cy="7" r="4"/>
								<line x1="12" y1="17" x2="12" y2="23"/>
								<line x1="9" y1="20" x2="15" y2="20"/>
							</svg>
						</div>
						<div>
							<h2 class="text-[var(--gw-text-base)] font-semibold text-[var(--gw-color-text)]">
								Add claude account
							</h2>
							<p class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
								Authorize a claude.ai account via browser login flow.
							</p>
						</div>
					</div>

					{#if step === 'idle'}
						<button type="button" class="cta flex-shrink-0" onclick={startOnboard}>
							<span>Add account</span>
							<span class="cta-arrow" aria-hidden="true">→</span>
						</button>
					{:else}
						<button
							type="button"
							class="btn-ghost flex-shrink-0"
							onclick={cancelOnboard}
							disabled={step === 'completing'}
						>
							Cancel
						</button>
					{/if}
				</div>

				<!-- Step: starting -->
				{#if step === 'starting'}
					<div class="mt-[var(--gw-space-4)] flex items-center gap-[var(--gw-space-2)]">
						<svg class="h-4 w-4 animate-spin text-[var(--gw-color-text-muted)]" viewBox="0 0 24 24" fill="none">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"/>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
						</svg>
						<p class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">Starting login…</p>
					</div>
				{/if}

				<!-- Steps: await + completing -->
				{#if step === 'await' || step === 'completing'}
					<div class="mt-[var(--gw-space-5)] max-w-2xl space-y-[var(--gw-space-4)]">

						<!-- Incognito warning -->
						<p class="warn-callout">
							<strong>Note:</strong> This authorizes whichever account is currently signed in to
							claude.ai. To add a <strong>different</strong> account, open the link in an
							<strong>incognito / private window</strong> (or sign out of claude.ai first) —
							claude.ai offers no account chooser.
						</p>

						<!-- Step 1 -->
						<div class="onboard-step space-y-[var(--gw-space-3)]">
							<p class="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">
								Step 1 — Open the login page
							</p>
							<code class="url-code">{loginUrl}</code>
							<div class="flex flex-wrap items-center gap-[var(--gw-space-2)]">
								<a
									href={loginUrl}
									target="_blank"
									rel="noopener noreferrer"
									class="btn-ghost"
								>
									<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
										stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
										<polyline points="15 3 21 3 21 9"/>
										<line x1="10" y1="14" x2="21" y2="3"/>
									</svg>
									Open link
								</a>
								<button type="button" class="btn-ghost" onclick={copyLink}>
									{#if copied}
										<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
											stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
											<polyline points="20 6 9 17 4 12"/>
										</svg>
										Copied
									{:else}
										<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
											stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
											<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
											<path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
										</svg>
										Copy link
									{/if}
								</button>
							</div>
						</div>

						<!-- Step 2 -->
						<div class="onboard-step space-y-[var(--gw-space-3)]">
							<p class="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">
								Step 2 — Paste the code
							</p>
							<div class="flex flex-wrap items-center gap-[var(--gw-space-2)]">
								<input
									bind:value={code}
									placeholder="Code from the login page"
									class="gw-input max-w-xs"
									disabled={step === 'completing'}
								/>
								<button
									type="button"
									class="cta flex-shrink-0"
									onclick={completeOnboard}
									disabled={step === 'completing'}
								>
									{#if step === 'completing'}
										<svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
											<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"/>
											<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
										</svg>
										<span>Finishing…</span>
									{:else}
										<span>Finish</span>
										<span class="cta-arrow" aria-hidden="true">→</span>
									{/if}
								</button>
							</div>
						</div>

					</div>
				{/if}

				{#if onboardErr}
					<p class="mt-[var(--gw-space-3)] text-[var(--gw-text-xs)] text-[var(--gw-color-error)]">
						{onboardErr}
					</p>
				{/if}

			</div>
		</section>
	{/if}

	<!-- ── Accounts table ──────────────────────────────────────────────────── -->
	<section class="entry entry-3 bezel" aria-label="Quota accounts">
		{#if canWrite}
			<div class="flex justify-end px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
				<form method="POST" action="?/sync" use:enhance={enhancer}>
					<button type="submit" class="btn-ghost" disabled={saving}>
						Sync quotas
					</button>
				</form>
			</div>
		{/if}
		<div class="bezel-core-overflow">
			{#if data.accounts.length > 0}
				<table class="w-full text-left">
					<thead>
						<tr class="border-b border-[var(--gw-color-border-subtle)]">
							<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Account</th>
							<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Status</th>
							<th class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)] sm:table-cell">Window</th>
							<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Usage</th>
							<th class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)] md:table-cell">Resets</th>
							<th class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)] md:table-cell">Activa en</th>
							{#if canWrite}
								<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-right text-[10px] font-semibold
									uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Actions</th>
							{/if}
						</tr>
					</thead>
					<tbody class="divide-y divide-[var(--gw-color-border-subtle)]">
						{#each data.accounts as acct (acct.id)}
							{@const wins = [acct.window, acct.weekly_window].filter((w) => !!w) as QuotaWindow[]}
							<tr class="data-row">
								<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
									<span class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-sm)]
										font-medium text-[var(--gw-color-text)]">
										{acct.id}
									</span>
								</td>
								<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
									{#if acct.status === 'Healthy'}
										<span class="badge-healthy">
											<span class="h-1.5 w-1.5 rounded-full bg-current"></span>
											{acct.status}
										</span>
									{:else}
										<span class="badge-warn">
											<span class="h-1.5 w-1.5 rounded-full bg-current"></span>
											{acct.status}
										</span>
									{/if}
								</td>
								<td class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] sm:table-cell">
									{#if wins.length}
										<div class="flex flex-col gap-[var(--gw-space-3)]">
											{#each wins as w}
												<span class="flex min-h-[2.25rem] flex-col justify-center text-[var(--gw-text-xs)]
													text-[var(--gw-color-text-muted)]">
													{w.kind}
												</span>
											{/each}
										</div>
									{:else}
										<span class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">—</span>
									{/if}
								</td>
								<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
									{#if wins.length}
										<div class="flex flex-col gap-[var(--gw-space-3)]">
											{#each wins as w}
												{@const p = pct(w)}
												<div class="flex min-h-[2.25rem] flex-col justify-center gap-[2px]">
													<div class="flex w-[120px] items-center gap-[var(--gw-space-2)]">
														<div class="bar-track">
															<div
																class="bar-fill {p >= 90 ? 'bar-fill-danger' : p >= 70 ? 'bar-fill-warn' : ''}"
																style="width: {p}%"
															></div>
														</div>
														<span class="w-8 shrink-0 text-right font-[family-name:var(--gw-font-mono)]
															text-[10px] font-semibold text-[var(--gw-color-text)]">
															{p}%
														</span>
													</div>
													<p class="whitespace-nowrap font-[family-name:var(--gw-font-mono)] text-[10px]
														text-[var(--gw-color-text-muted)]">
														{w.consumed} / {w.limit}
													</p>
												</div>
											{/each}
										</div>
									{:else}
										<span class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">—</span>
									{/if}
								</td>
								<td class="hidden whitespace-nowrap px-[var(--gw-space-4)] py-[var(--gw-space-3)] md:table-cell">
									{#if wins.length}
										<div class="flex flex-col gap-[var(--gw-space-3)]">
											{#each wins as w}
												<span class="flex min-h-[2.25rem] flex-col justify-center
													font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)]
													text-[var(--gw-color-text-muted)]">
													{fmtTime(w.resets_at_secs)}
												</span>
											{/each}
										</div>
									{:else}
										<span class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)]
											text-[var(--gw-color-text-muted)]">—</span>
									{/if}
								</td>
								<td class="hidden whitespace-nowrap px-[var(--gw-space-4)] py-[var(--gw-space-3)] md:table-cell">
									{#if activatesIn(acct)}
										<span class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)]
											text-[var(--gw-color-text-muted)]">{activatesIn(acct)}</span>
									{:else}
										<span class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">—</span>
									{/if}
								</td>
								{#if canWrite}
									<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
										<span class="flex items-center justify-end gap-[var(--gw-space-2)]">
											<form
												method="POST"
												action="?/rotate"
												use:enhance={enhancer}
												onsubmit={(e) => {
													if (!confirm(`Rotate credentials for ${acct.id}?`)) e.preventDefault();
												}}
											>
												<input type="hidden" name="account" value={acct.id} />
												<button type="submit" class="btn-ghost" disabled={saving}>Rotate</button>
											</form>
											<form
												method="POST"
												action="?/retire"
												use:enhance={enhancer}
												onsubmit={(e) => {
													if (!confirm(`Retire ${acct.id} from the rotation pool?`)) e.preventDefault();
												}}
											>
												<input type="hidden" name="account" value={acct.id} />
												<button type="submit" class="btn-danger" disabled={saving}>Retire</button>
											</form>
										</span>
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<div
					class="flex flex-col items-center justify-center gap-[var(--gw-space-2)]
						px-[var(--gw-space-6)] py-[var(--gw-space-10)]"
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
						stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
						style="color: var(--gw-color-text-muted); opacity: 0.4" aria-hidden="true">
						<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
						<circle cx="12" cy="7" r="4"/>
					</svg>
					<p class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">No quota accounts.</p>
				</div>
			{/if}
		</div>
	</section>

</div>
