<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import {
		browserAdmin,
		type QuotaWindow,
		type WindowReset,
		type TokenSample,
		type CredHealth
	} from '$lib/api/admin';
	import EChart from '$lib/components/EChart.svelte';
	import { hasScope } from '$lib/api/auth';
	import { TrackerError } from '$lib/api/tracker';
	import { normalizeModel } from '$lib/models';
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

	const fmtTime = (secs: number) => new Date(secs * 1000).toLocaleString();

	// ── Credential health (gtcore-3cab31) ────────────────────────────────────
	// Quota *usage* (the table's Status/Usage) and credential *validity* are orthogonal: an
	// account can be quota-Healthy while its keychain credential is dead (no refresh token, or the
	// dir never finished onboarding) → polecats slung on it 401 silently. The daemon exposes health
	// per account; we fetch it client-side (keychain lives on the orch host, not the SSR backend)
	// and merge by id. Tolerates the route being absent until the backend sibling deploys.
	let health = $state<Record<string, CredHealth>>({});

	async function loadHealth() {
		try {
			const rows = await api.quotaHealth();
			const next: Record<string, CredHealth> = {};
			for (const h of rows) next[h.account] = h;
			health = next;
		} catch {
			// Endpoint not deployed yet (or transient): leave prior health, degrade to "unknown".
		}
	}

	/** True only when the backend positively reports the account needs a relogin. */
	const needsRelogin = (id: string): boolean => health[id]?.needs_relogin === true;

	/** Relative expiry label for a stored credential: "in 3d", "in 5h", "expired", or "—". */
	const expiryLabel = (secs: number | null | undefined, now: number): string => {
		if (secs == null) return '—';
		const d = secs - now;
		if (d <= 0) return 'expired';
		if (d < 3600) return `in ${Math.floor(d / 60)}m`;
		if (d < 86400) return `in ${Math.floor(d / 3600)}h`;
		return `in ${Math.floor(d / 86400)}d`;
	};

	// ── Per-account relogin flow (gtcore-1fe9b4) ─────────────────────────────
	// Mirrors the "Add account" onboarding flow but re-authorizes an EXISTING keychain dir: the
	// daemon re-runs `claude /login` against that account's CLAUDE_CONFIG_DIR and reseeds the
	// onboarding-complete state. Rendered as a focused modal so it works from any table row.
	let reAcct = $state('');
	let reStep = $state<Step>('idle');
	let reUrl = $state('');
	let reSession = $state('');
	let reCode = $state('');
	let reErr = $state('');
	let reCopied = $state(false);

	async function startRelogin(account: string) {
		reAcct = account;
		reErr = '';
		reCode = '';
		reStep = 'starting';
		try {
			const { session_id, url } = await api.reloginStart(account);
			reSession = session_id;
			reUrl = url;
			reStep = 'await';
		} catch (e) {
			reErr = errText(e);
			reStep = 'idle';
		}
	}

	async function completeRelogin() {
		if (!reCode.trim()) { reErr = 'Paste the code from the login page.'; return; }
		reErr = '';
		reStep = 'completing';
		try {
			await api.reloginComplete(reSession, reCode.trim());
			cancelRelogin();
			await Promise.all([loadHealth(), invalidateAll()]);
		} catch (e) {
			reErr = errText(e);
			reStep = 'await';
		}
	}

	function cancelRelogin() {
		reAcct = ''; reStep = 'idle'; reUrl = ''; reSession = ''; reCode = ''; reErr = ''; reCopied = false;
	}

	async function copyReloginLink() {
		try {
			await navigator.clipboard.writeText(reUrl);
			reCopied = true;
			setTimeout(() => (reCopied = false), 2000);
		} catch {
			reErr = 'Could not copy — select the link and copy manually.';
		}
	}

	/** Relative "X ago" label for probe freshness. */
	const probeAge = (last: number | null | undefined, now: number): string => {
		if (last == null) return 'never';
		const d = now - last;
		if (d < 60) return `${d}s ago`;
		if (d < 3600) return `${Math.floor(d / 60)}m ago`;
		return `${Math.floor(d / 3600)}h ago`;
	};

	/** A window whose reset instant already passed: the provider quota re-opened, so any
	 *  `consumed` still on the row is stale until the next probe overwrites it. */
	const isExpired = (w: QuotaWindow, now: number) => now >= w.resets_at_secs;

	/** Bar widths for the two-tone probe bar.
	 *  confirmed = provider-verified portion; sampled = local unverified tail. */
	const barWidths = (w: QuotaWindow, sampledSinceProbe: number, now: number) => {
		if (w.limit === 0 || isExpired(w, now)) return { confirmed: 0, sampled: 0 };
		const confirmed = Math.min(100, ((w.consumed - sampledSinceProbe) / w.limit) * 100);
		const sampled   = Math.min(100 - confirmed, (sampledSinceProbe / w.limit) * 100);
		return { confirmed: Math.max(0, confirmed), sampled: Math.max(0, sampled) };
	};

	/**
	 * Percentage to flag for the badge colour, taking the higher of:
	 *   - actual:    consumed / limit
	 *   - projected: rate × window_duration / limit (Rolling5h only — a Weekly window is
	 *     seeded with started_at = probe instant, so elapsed starts near the 60s floor while
	 *     duration spans days and the projection saturates on minimal consumption)
	 * A 60s floor on elapsed avoids div-by-zero and startup noise.
	 * Returns 0 when limit is unknown (0) or the window already reset (stale `consumed`).
	 */
	const warningPct = (w: QuotaWindow, now: number): number => {
		if (w.limit === 0 || isExpired(w, now)) return 0;
		const actual = (w.consumed / w.limit) * 100;
		if (w.kind !== 'Rolling5h') return Math.min(100, actual);
		const elapsed = Math.max(now - w.started_at_secs, 60);
		const rate = w.consumed / elapsed; // cost-units / sec
		const duration = w.resets_at_secs - w.started_at_secs;
		const projected = (rate * duration / w.limit) * 100;
		return Math.min(100, Math.max(actual, projected));
	};

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
							? `${acct.id} — account reactivated (${was} → Healthy)`
							: `${acct.id} — account deactivated (${was} → ${acct.status})`,
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

	// ── Live countdown + data refresh ────────────────────────────────────────
	// invalidateAll re-runs the load so server-side status lifts (probe sweeps flipping
	// Cooldown/Limited/Blocked → Healthy) reach the pills without a manual reload.
	let nowSecs = $state(Math.floor(Date.now() / 1000));
	$effect(() => {
		void loadHealth(); // initial cred-health snapshot alongside the SSR-loaded usage
		const t = setInterval(() => {
			nowSecs = Math.floor(Date.now() / 1000);
			void invalidateAll();
			void loadHealth();
		}, 30_000);
		return () => clearInterval(t);
	});

	function activatesIn(
		acct: { status: string; window: QuotaWindow | null; weekly_window?: QuotaWindow | null },
		atRisk = false
	): string | null {
		if (acct.status === 'Disabled') return null;
		const wins = [acct.window, acct.weekly_window ?? null].filter((w): w is QuotaWindow => !!w);
		if (wins.length === 0) return null;
		let w: QuotaWindow;
		if (acct.status === 'Healthy') {
			if (!atRisk) return null;
			// At-risk (orange pill): count down on whichever window drives the warning.
			w = wins.reduce((a, b) => (warningPct(a, nowSecs) >= warningPct(b, nowSecs) ? a : b));
		} else {
			w = wins[0];
		}
		const rem = w.resets_at_secs - nowSecs;
		if (rem <= 0) return 'soon';
		const h = Math.floor(rem / 3600);
		const m = Math.floor((rem % 3600) / 60);
		if (h > 0) return `${h}h ${m}m`;
		return m > 0 ? `${m}m` : '<1m';
	}

	// ── Accounts sort ────────────────────────────────────────────────────────
	type SortKey = 'account' | 'status' | 'usage' | 'resets';
	let sortKey = $state<SortKey | null>(null);
	let sortDir = $state(1);

	function toggleSort(k: SortKey) {
		if (sortKey === k) sortDir = -sortDir;
		else { sortKey = k; sortDir = 1; }
	}

	// Operational severity, not alphabetical: Healthy first ascending.
	const STATUS_RANK: Record<string, number> = { Healthy: 0, Cooldown: 1, Limited: 2, Blocked: 3, Disabled: 4 };
	type Acct = (typeof data.accounts)[number];
	const acctWins = (a: Acct) => [a.window, a.weekly_window].filter((w): w is QuotaWindow => !!w);
	const acctWarnPct = (a: Acct) => {
		const ws = acctWins(a);
		return ws.length ? Math.max(...ws.map((w) => warningPct(w, nowSecs))) : 0;
	};
	const acctNextReset = (a: Acct) => {
		const ws = acctWins(a);
		return ws.length ? Math.min(...ws.map((w) => w.resets_at_secs)) : Number.MAX_SAFE_INTEGER;
	};

	const sortedAccounts = $derived.by(() => {
		const arr = [...data.accounts];
		const dir = sortDir;
		switch (sortKey) {
			case 'account': arr.sort((a, b) => dir * a.id.localeCompare(b.id)); break;
			case 'status':  arr.sort((a, b) => dir * ((STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9))); break;
			case 'usage':   arr.sort((a, b) => dir * (acctWarnPct(a) - acctWarnPct(b))); break;
			case 'resets':  arr.sort((a, b) => dir * (acctNextReset(a) - acctNextReset(b))); break;
		}
		return arr;
	});

	// ── Burn-rate chart ──────────────────────────────────────────────────────
	// Consumption over time in adaptive buckets, stacked by a selectable dimension
	// (model / session / account). TokensSampled events carry now_secs, so this is
	// pure client-side aggregation.
	type BurnBy = 'model' | 'session' | 'account';
	let burnBy = $state<BurnBy>('model');

	/** Legend cap: groups beyond the top N fold into "other" (sessions can be many). */
	const BURN_TOP_GROUPS = 7;

	const burnChart = $derived.by(() => {
		const samples: TokenSample[] = (data.tokens ?? []).filter((s) => (s.now_secs ?? 0) > 0);
		if (samples.length === 0) return null;

		const groupOf = (s: TokenSample) =>
			burnBy === 'model'
				? normalizeModel(s.model)
				: (burnBy === 'session' ? s.session : s.account) || 'unknown';
		const tokensOf = (s: TokenSample) => s.input + s.output + s.cache_read + s.cache_creation;

		// Rank groups by total burn; the tail folds into "other".
		const totalsByGroup = new Map<string, number>();
		for (const s of samples) {
			const g = groupOf(s);
			totalsByGroup.set(g, (totalsByGroup.get(g) ?? 0) + tokensOf(s));
		}
		const ranked = [...totalsByGroup.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g);
		const top = new Set(ranked.slice(0, BURN_TOP_GROUPS));
		const groups = [
			...ranked.slice(0, BURN_TOP_GROUPS),
			...(ranked.length > BURN_TOP_GROUPS ? ['other'] : []),
		];

		// Adaptive buckets: ~40 across the sample span, snapped to 5-minute multiples.
		const times = samples.map((s) => s.now_secs);
		const tMin = Math.min(...times);
		const tMax = Math.max(...times);
		const bucket = Math.max(300, Math.ceil((tMax - tMin) / 40 / 300) * 300);
		const nBuckets = Math.floor((tMax - tMin) / bucket) + 1;

		const sums: Map<string, number>[] = Array.from({ length: nBuckets }, () => new Map());
		for (const s of samples) {
			const i = Math.floor((s.now_secs - tMin) / bucket);
			const g0 = groupOf(s);
			const g = top.has(g0) ? g0 : 'other';
			sums[i].set(g, (sums[i].get(g) ?? 0) + tokensOf(s));
		}

		// SESSION/ACCOUNT (gallery pick: area-stacked, gtweb-ce0f52): stacked bands show the
		// per-group share while the top edge tracks total burn — useful when several groups
		// are comparable. MODEL is NOT stacked (gtweb-02c342): with a dominant model (e.g.
		// opus ~100%), a stacked area makes the minority series' line trace the cumulative
		// TOTAL, so a near-zero model (sonnet) appears to crown every peak and look like the
		// leader. Drawing each model as its own un-stacked band makes the dominant model the
		// prominent one in its own colour, and ~0 models sit flat at the bottom.
		const stacked = burnBy !== 'model';
		const series = groups.map((g, i) => ({
			name: g,
			type: 'line' as const,
			...(stacked ? { stack: 'total' } : {}),
			smooth: 0.2,
			symbol: 'circle',
			symbolSize: 5,
			areaStyle: { opacity: stacked ? 0.3 : 0.2 },
			color: g === 'other' ? '#a1a1aa' : CHART_PALETTE[i % CHART_PALETTE.length],
			emphasis: { focus: 'series' as const },
			data: sums.map((m, idx) => [
				(tMin + idx * bucket + bucket / 2) * 1000,
				Math.ceil(m.get(g) ?? 0),
			]),
		}));

		return { option: { ...baseTimeOption(), series }, bucket };
	});

	// ── Model breakdown chart ────────────────────────────────────────────────
	// Aggregate TokensSampled events by model, rendered as an ECharts horizontal
	// stacked bar (gallery: bar-y-category-stack, gtweb-f3a794).
	const modelChart = $derived.by(() => {
		const samples: TokenSample[] = data.tokens ?? [];
		if (samples.length === 0) return null;

		type Row = { model: string; input: number; output: number; cache: number; total: number };
		const byModel = new Map<string, Row>();
		for (const s of samples) {
			const key = normalizeModel(s.model);
			const existing = byModel.get(key) ?? { model: key, input: 0, output: 0, cache: 0, total: 0 };
			existing.input += s.input;
			existing.output += s.output;
			existing.cache += s.cache_read + s.cache_creation;
			existing.total += s.input + s.output + s.cache_read + s.cache_creation;
			byModel.set(key, existing);
		}
		// Ascending so the heaviest model lands on the top row of the category axis.
		const rows = [...byModel.values()].sort((a, b) => a.total - b.total);

		const mk = (name: string, key: 'input' | 'output' | 'cache', color: string) => ({
			name,
			type: 'bar' as const,
			stack: 'total',
			color,
			emphasis: { focus: 'series' as const },
			data: rows.map((r) => r[key]),
		});

		const option = {
			animationDuration: 300,
			grid: { left: 8, right: 48, top: 32, bottom: 8, containLabel: true },
			legend: {
				top: 0,
				icon: 'circle',
				itemWidth: 8,
				itemHeight: 8,
				textStyle: { fontSize: 10, color: '#71717a' },
			},
			tooltip: {
				trigger: 'axis' as const,
				axisPointer: { type: 'shadow' as const },
				textStyle: { fontSize: 11 },
				valueFormatter: (v: unknown) => Number(v).toLocaleString(),
			},
			xAxis: {
				type: 'value' as const,
				axisLabel: { fontSize: 9, color: '#71717a', formatter: compactNum },
				splitLine: { lineStyle: { color: '#e4e4e7' } },
			},
			yAxis: {
				type: 'category' as const,
				data: rows.map((r) => r.model),
				axisLabel: { fontSize: 10, color: '#71717a' },
			},
			series: [
				mk('Input', 'input', 'oklch(60% 0.22 250)'),
				mk('Output', 'output', 'oklch(62% 0.20 160)'),
				mk('Cache', 'cache', 'oklch(58% 0.12 80)'),
			],
		};

		return {
			option,
			samples: samples.length,
			models: rows.length,
			height: Math.max(120, rows.length * 36 + 64),
		};
	});

	// Behaviour filter: window kind (the account filter is ECharts' native legend).
	let kindFilter = $state<'all' | 'Rolling5h' | 'Weekly'>('all');

	const CHART_PALETTE = [
		'oklch(60% 0.22 250)',  // blue
		'oklch(62% 0.20 160)',  // teal
		'oklch(58% 0.20 300)',  // purple
		'oklch(60% 0.22 40)',   // orange
		'oklch(60% 0.18 120)',  // green
		'oklch(55% 0.18 0)',    // red
		'oklch(65% 0.15 200)',  // cyan
	];

	/** Compact axis labels: 46_000_000 → 46M. */
	const compactNum = (v: number) =>
		v >= 1e6 ? `${Math.round(v / 1e5) / 10}M` : v >= 1e3 ? `${Math.round(v / 100) / 10}k` : `${v}`;

	/** Shared interactive scaffolding for both time charts. */
	const baseTimeOption = () => ({
		animationDuration: 300,
		grid: { left: 56, right: 16, top: 32, bottom: 52 },
		legend: {
			type: 'scroll' as const,
			top: 0,
			icon: 'circle',
			itemWidth: 8,
			itemHeight: 8,
			textStyle: { fontSize: 10, color: '#71717a' },
		},
		tooltip: {
			trigger: 'axis' as const,
			axisPointer: { type: 'cross' as const },
			textStyle: { fontSize: 11 },
			valueFormatter: (v: unknown) => Number(v).toLocaleString(),
		},
		xAxis: {
			type: 'time' as const,
			axisLabel: { fontSize: 9, color: '#71717a' },
			axisLine: { lineStyle: { color: '#d4d4d8' } },
		},
		yAxis: {
			type: 'value' as const,
			axisLabel: { fontSize: 9, color: '#71717a', formatter: compactNum },
			splitLine: { lineStyle: { color: '#e4e4e7' } },
		},
		dataZoom: [
			{ type: 'inside' as const },
			{ type: 'slider' as const, height: 14, bottom: 8, borderColor: 'transparent' },
		],
	});

	const historyChart = $derived.by(() => {
		// Idle rollovers (the actor tick emits a WindowReset every time an untouched window
		// turns over) carry consumed≈0 — bookkeeping, not history: dropped here.
		const all: WindowReset[] = (data.history ?? []).filter((r) => r.consumed >= 1);
		if (all.length === 0) return null;

		const accounts = [...new Set(all.map((r) => r.account))];
		const resets = all.filter((r) => kindFilter === 'all' || r.kind === kindFilter);

		const series = accounts.map((a, i) => ({
			name: a,
			type: 'line' as const,
			smooth: 0.2,
			symbolSize: 6,
			color: CHART_PALETTE[i % CHART_PALETTE.length],
			emphasis: { focus: 'series' as const },
			data: resets
				.filter((r) => r.account === a)
				.sort((x, y) => x.resets_at_secs - y.resets_at_secs)
				.map((r) => [r.resets_at_secs * 1000, Math.ceil(r.consumed)]),
		}));

		return { option: { ...baseTimeOption(), series }, shown: resets.length };
	});
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
	.badge-disabled {
		display: inline-flex; align-items: center; gap: 4px; border-radius: 9999px;
		background-color: oklch(97% 0.03 25); border: 1px solid oklch(88% 0.1 25);
		color: oklch(45% 0.22 25); font-size: 10px; font-weight: 600;
		padding: 2px 7px; text-transform: uppercase; letter-spacing: 0.06em;
	}
	.badge-reset {
		display: inline-flex; align-items: center; gap: 4px; border-radius: 9999px;
		background-color: oklch(96% 0.04 190); border: 1px solid oklch(85% 0.08 190);
		color: oklch(42% 0.12 190); font-size: 10px; font-weight: 600;
		padding: 2px 7px; text-transform: uppercase; letter-spacing: 0.06em;
	}
	/* Credential-dead signal — orthogonal to quota status (an account can be quota-Healthy
	   yet need a relogin). Deliberately the loudest badge: a wedged sling is silent otherwise. */
	.badge-relogin {
		display: inline-flex; align-items: center; gap: 4px; border-radius: 9999px;
		background-color: oklch(95% 0.06 25); border: 1px solid oklch(80% 0.14 25);
		color: oklch(48% 0.22 25); font-size: 10px; font-weight: 600;
		padding: 2px 7px; text-transform: uppercase; letter-spacing: 0.06em;
	}

	/* Credential health chips (refresh / onboarding presence) */
	.cred-chip {
		display: inline-flex; align-items: center; gap: 3px;
		font-family: var(--gw-font-mono); font-size: 10px; font-weight: 600;
	}
	.cred-ok   { color: oklch(45% 0.14 150); }
	.cred-bad  { color: var(--gw-color-error); }
	.cred-unknown { color: var(--gw-color-text-muted); }

	/* Relogin modal overlay */
	.modal-backdrop {
		position: fixed; inset: 0; z-index: 50;
		display: flex; align-items: center; justify-content: center;
		padding: var(--gw-space-4);
		background-color: oklch(20% 0.02 270 / 0.45);
		backdrop-filter: blur(2px);
		animation: fade-up-in 200ms cubic-bezier(0.32, 0.72, 0, 1) both;
	}
	.modal-card {
		width: 100%; max-width: 32rem;
		border-radius: var(--gw-radius-2xl);
		border: 1px solid var(--gw-color-border-subtle);
		background-color: var(--gw-color-surface);
		box-shadow: 0 24px 60px -12px oklch(20% 0.02 270 / 0.4);
		padding: var(--gw-space-6);
	}


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

	/* Burn-chart group-by toggle */
	.burn-toggle {
		border-radius: 9999px; border: 1px solid var(--gw-color-border);
		background-color: var(--gw-color-surface-3); color: var(--gw-color-text-muted);
		font-size: 10px; font-weight: 600; padding: 2px 10px; cursor: pointer;
		text-transform: uppercase; letter-spacing: 0.06em;
		transition: color 120ms, border-color 120ms, background-color 120ms;
	}
	.burn-toggle:hover { color: var(--gw-color-text); }
	.burn-toggle-active {
		background-color: var(--gw-color-surface); color: var(--gw-color-text);
		border-color: var(--gw-color-primary);
	}

	/* Sortable column header — inherits the th typography */
	.th-sort {
		display: inline-flex; align-items: center; gap: 3px;
		background: none; border: none; padding: 0; cursor: pointer;
		font: inherit; color: inherit; text-transform: inherit; letter-spacing: inherit;
		transition: color 120ms;
	}
	.th-sort:hover { color: var(--gw-color-text); }

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
					<button class="notif-dismiss" onclick={() => dismissNotif(n.id)} aria-label="Dismiss notification">
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

	<!-- ── History chart ──────────────────────────────────────────────────── -->
	{#if historyChart}
		<section class="entry entry-2 bezel" aria-label="Token usage history">
			<div class="bezel-core px-[var(--gw-space-6)] py-[var(--gw-space-5)]">
				<div class="mb-[var(--gw-space-2)] flex flex-wrap items-center justify-between gap-[var(--gw-space-2)]">
					<h2 class="text-[var(--gw-text-sm)] font-semibold text-[var(--gw-color-text)]">
						Token usage — past windows
					</h2>
					<!-- Window-kind filter -->
					<div class="flex items-center gap-[var(--gw-space-1)]" role="group" aria-label="Filter by window kind">
						<button type="button" class="burn-toggle {kindFilter === 'all' ? 'burn-toggle-active' : ''}"
							onclick={() => (kindFilter = 'all')}>All</button>
						<button type="button" class="burn-toggle {kindFilter === 'Rolling5h' ? 'burn-toggle-active' : ''}"
							onclick={() => (kindFilter = 'Rolling5h')}>5h</button>
						<button type="button" class="burn-toggle {kindFilter === 'Weekly' ? 'burn-toggle-active' : ''}"
							onclick={() => (kindFilter = 'Weekly')}>Weekly</button>
					</div>
				</div>
				<EChart option={historyChart.option} height={240} />
				<p class="mt-[var(--gw-space-1)] text-[10px] text-[var(--gw-color-text-muted)]">
					{historyChart.shown} window reset{historyChart.shown === 1 ? '' : 's'} shown ·
					scroll/drag to zoom · click legend to toggle accounts
				</p>
			</div>
		</section>
	{/if}

	<!-- ── Burn-rate chart (over time, by model/session/account) ───────────── -->
	{#if burnChart}
		<section class="entry entry-2 bezel" aria-label="Token burn over time">
			<div class="bezel-core px-[var(--gw-space-6)] py-[var(--gw-space-5)]">
				<div class="mb-[var(--gw-space-3)] flex flex-wrap items-center justify-between gap-[var(--gw-space-2)]">
					<h2 class="text-[var(--gw-text-sm)] font-semibold text-[var(--gw-color-text)]">
						Token burn over time
					</h2>
					<div class="flex items-center gap-[var(--gw-space-1)]" role="group" aria-label="Group burn chart by">
						<button type="button" class="burn-toggle {burnBy === 'model' ? 'burn-toggle-active' : ''}"
							onclick={() => (burnBy = 'model')}>Model</button>
						<button type="button" class="burn-toggle {burnBy === 'session' ? 'burn-toggle-active' : ''}"
							onclick={() => (burnBy = 'session')}>Session</button>
						<button type="button" class="burn-toggle {burnBy === 'account' ? 'burn-toggle-active' : ''}"
							onclick={() => (burnBy = 'account')}>Account</button>
					</div>
				</div>
				<EChart option={burnChart.option} height={220} />
				<p class="mt-[var(--gw-space-1)] text-[10px] text-[var(--gw-color-text-muted)]">
					{Math.round(burnChart.bucket / 60)}min buckets · scroll/drag to zoom · click legend to toggle
				</p>
			</div>
		</section>
	{/if}

	<!-- ── Model breakdown chart ───────────────────────────────────────────── -->
	{#if modelChart}
		<section class="entry entry-2 bezel" aria-label="Token usage by model">
			<div class="bezel-core px-[var(--gw-space-6)] py-[var(--gw-space-5)]">
				<h2 class="mb-[var(--gw-space-2)] text-[var(--gw-text-sm)] font-semibold text-[var(--gw-color-text)]">
					Tokens by model
				</h2>
				<EChart option={modelChart.option} height={modelChart.height} />
				<p class="mt-[var(--gw-space-1)] text-[10px] text-[var(--gw-color-text-muted)]">
					{modelChart.samples.toLocaleString()} samples · {modelChart.models} model{modelChart.models === 1 ? '' : 's'} · click legend to toggle
				</p>
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
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">
								<button type="button" class="th-sort" onclick={() => toggleSort('account')}>
									Account{#if sortKey === 'account'}<span aria-hidden="true">{sortDir === 1 ? '▲' : '▼'}</span>{/if}
								</button>
							</th>
							<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">
								<button type="button" class="th-sort" onclick={() => toggleSort('status')}>
									Status{#if sortKey === 'status'}<span aria-hidden="true">{sortDir === 1 ? '▲' : '▼'}</span>{/if}
								</button>
							</th>
							<th class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)] md:table-cell">Credential</th>
							<th class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)] sm:table-cell">Window</th>
							<th class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)] sm:table-cell">Probe</th>
							<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">
								<button type="button" class="th-sort" onclick={() => toggleSort('usage')}>
									Usage{#if sortKey === 'usage'}<span aria-hidden="true">{sortDir === 1 ? '▲' : '▼'}</span>{/if}
								</button>
							</th>
							<th class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)] md:table-cell">
								<button type="button" class="th-sort" onclick={() => toggleSort('resets')}>
									Resets{#if sortKey === 'resets'}<span aria-hidden="true">{sortDir === 1 ? '▲' : '▼'}</span>{/if}
								</button>
							</th>
							<th class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)] md:table-cell">Activates in</th>
							{#if canWrite}
								<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-right text-[10px] font-semibold
									uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Actions</th>
							{/if}
						</tr>
					</thead>
					<tbody class="divide-y divide-[var(--gw-color-border-subtle)]">
						{#each sortedAccounts as acct (acct.id)}
							{@const wins = [acct.window, acct.weekly_window].filter((w) => !!w) as QuotaWindow[]}
							{@const sampled = acct.sampled_since_probe ?? 0}
							{@const maxWarnPct = wins.length ? Math.max(...wins.map((w) => warningPct(w, nowSecs))) : 0}
							{@const allExpired = wins.length > 0 && wins.every((w) => isExpired(w, nowSecs))}
							<tr class="data-row">
								<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
									<span class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-sm)]
										font-medium text-[var(--gw-color-text)]">
										{acct.id}
									</span>
								</td>
								<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
									<span class="flex flex-col items-start gap-[var(--gw-space-1)]">
										{#if acct.status === 'Disabled'}
											<span class="badge-disabled">
												<span class="h-1.5 w-1.5 rounded-full bg-current"></span>
												{acct.status}
											</span>
										{:else if acct.status === 'Healthy' && maxWarnPct >= 90}
											<span class="badge-warn">
												<span class="h-1.5 w-1.5 rounded-full bg-current"></span>
												{acct.status}
											</span>
										{:else if acct.status === 'Healthy'}
											<span class="badge-healthy">
												<span class="h-1.5 w-1.5 rounded-full bg-current"></span>
												{acct.status}
											</span>
										{:else if allExpired}
											<!-- Every known window already reset: the block/cooldown is stale and the
											     account is merely awaiting the re-probe that lifts it to Healthy
											     (mirrors the domain's is_genuinely_blocked freshness rule). -->
											<span class="badge-reset" title="{acct.status} — window reset, awaiting re-probe">
												<span class="h-1.5 w-1.5 rounded-full bg-current"></span>
												Resetting
											</span>
										{:else}
											<span class="badge-warn">
												<span class="h-1.5 w-1.5 rounded-full bg-current"></span>
												{acct.status}
											</span>
										{/if}
										<!-- Credential-dead signal, independent of quota status. -->
										{#if needsRelogin(acct.id)}
											<span class="badge-relogin" title="Credential needs an operator relogin">
												<span class="h-1.5 w-1.5 rounded-full bg-current"></span>
												Needs relogin
											</span>
										{/if}
									</span>
								</td>
								<!-- Credential health: refresh token + expiry + onboarding presence -->
								<td class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] md:table-cell">
									{#if health[acct.id]}
										{@const h = health[acct.id]}
										<div class="flex min-h-[2.25rem] flex-col justify-center gap-[2px]">
											<span class="cred-chip {h.refresh ? 'cred-ok' : 'cred-bad'}">
												{#if h.refresh}
													<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
														stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
														<polyline points="20 6 9 17 4 12"/>
													</svg>
												{:else}
													<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
														stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
														<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
													</svg>
												{/if}
												refresh
											</span>
											<span class="cred-chip cred-unknown" title="Credential expiry">
												{expiryLabel(h.expires_at_secs, nowSecs)}
											</span>
											<span class="cred-chip {h.onboarding_complete ? 'cred-ok' : 'cred-bad'}"
												title="Config dir onboarding-complete (consumable by the sling)">
												{#if h.onboarding_complete}
													<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
														stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
														<polyline points="20 6 9 17 4 12"/>
													</svg>
												{:else}
													<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
														stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
														<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
													</svg>
												{/if}
												onboarding
											</span>
										</div>
									{:else}
										<span class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">—</span>
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
								<!-- Probe freshness column -->
								<td class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] sm:table-cell">
									<div class="flex min-h-[2.25rem] flex-col justify-center gap-[2px]">
										<span class="font-[family-name:var(--gw-font-mono)] text-[10px]
											{acct.last_probe_secs == null ? 'text-[var(--gw-color-error)]' : 'text-[var(--gw-color-text-muted)]'}">
											{probeAge(acct.last_probe_secs, nowSecs)}
										</span>
										{#if sampled > 0}
											<span class="font-[family-name:var(--gw-font-mono)] text-[10px]"
												style="color: oklch(60% 0.15 80)">
												+{Math.ceil(sampled).toLocaleString()} est.
											</span>
										{/if}
									</div>
								</td>
								<!-- Donut usage -->
								<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
									{#if wins.length}
										<div class="flex flex-col gap-[var(--gw-space-3)]">
											{#each wins as w}
												{@const bw = barWidths(w, sampled, nowSecs)}
												{@const dcx = 18}
												{@const dcy = 18}
												{@const dr = 13}
												{@const dC = 2 * Math.PI * dr}
												{@const confLen = (bw.confirmed / 100) * dC}
												{@const sampLen = (bw.sampled / 100) * dC}
												{@const confDeg = (bw.confirmed / 100) * 360}
												{@const totalPct = Math.round(bw.confirmed + bw.sampled)}
												{@const dcolor = acct.status === 'Disabled' ? 'var(--gw-color-error)' : maxWarnPct >= 90 ? 'oklch(52% 0.18 80)' : 'var(--gw-color-primary)'}
												<div class="flex min-h-[2.25rem] items-center gap-[var(--gw-space-2)]">
													<svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
														<!-- Track -->
														<circle cx={dcx} cy={dcy} r={dr} fill="none"
															stroke="var(--gw-color-surface-3)" stroke-width="4" />
														<!-- Sampled (unverified tail) -->
														{#if sampLen > 0.5}
															<circle cx={dcx} cy={dcy} r={dr} fill="none"
																stroke={dcolor} stroke-opacity="0.3" stroke-width="4"
																stroke-dasharray="{sampLen} {dC}"
																transform="rotate({-90 + confDeg} {dcx} {dcy})" />
														{/if}
														<!-- Confirmed -->
														{#if confLen > 0.5}
															<circle cx={dcx} cy={dcy} r={dr} fill="none"
																stroke={dcolor} stroke-width="4"
																stroke-dasharray="{confLen} {dC}"
																transform="rotate(-90 {dcx} {dcy})" />
														{/if}
														<text x={dcx} y={dcy} text-anchor="middle" dominant-baseline="central"
															font-size="8" font-weight="700" fill="var(--gw-color-text)"
															font-family="var(--gw-font-mono)">{totalPct}%</text>
													</svg>
													<p class="whitespace-nowrap font-[family-name:var(--gw-font-mono)] text-[10px]
														text-[var(--gw-color-text-muted)]">
														{Math.ceil(w.consumed).toLocaleString()}
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
									{#if activatesIn(acct, maxWarnPct >= 90)}
										<span class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)]
											text-[var(--gw-color-text-muted)]">{activatesIn(acct, maxWarnPct >= 90)}</span>
									{:else}
										<span class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">—</span>
									{/if}
								</td>
								{#if canWrite}
									<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
										<span class="flex items-center justify-end gap-[var(--gw-space-2)]">
											<!-- Relogin: re-authorize the account's existing keychain dir (cred + onboarding).
											     Only shown when the backend reports the account needs a relogin,
											     mirroring the "Needs relogin" badge condition above. -->
											{#if needsRelogin(acct.id)}
												<button
													type="button"
													class="btn-ghost"
													onclick={() => startRelogin(acct.id)}
													disabled={saving || reStep !== 'idle'}
												>
													Relogin
												</button>
											{/if}
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

	<!-- ── Relogin modal (per-account) ──────────────────────────────────────── -->
	{#if reAcct}
		<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Relogin account">
			<div class="modal-card space-y-[var(--gw-space-4)]">
				<div class="flex items-start justify-between gap-[var(--gw-space-4)]">
					<div class="space-y-[2px]">
						<h2 class="text-[var(--gw-text-base)] font-semibold text-[var(--gw-color-text)]">
							Relogin account
						</h2>
						<p class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)]
							text-[var(--gw-color-text-muted)]">{reAcct}</p>
					</div>
					<button
						type="button"
						class="btn-ghost flex-shrink-0"
						onclick={cancelRelogin}
						disabled={reStep === 'completing'}
					>
						Close
					</button>
				</div>

				<!-- Step: starting -->
				{#if reStep === 'starting'}
					<div class="flex items-center gap-[var(--gw-space-2)]">
						<svg class="h-4 w-4 animate-spin text-[var(--gw-color-text-muted)]" viewBox="0 0 24 24" fill="none">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"/>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
						</svg>
						<p class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">Starting login…</p>
					</div>
				{/if}

				<!-- Steps: await + completing -->
				{#if reStep === 'await' || reStep === 'completing'}
					<div class="space-y-[var(--gw-space-4)]">
						<p class="warn-callout">
							<strong>Note:</strong> This re-authorizes the credential dir for
							<strong>{reAcct}</strong>. Make sure claude.ai is signed in as that account —
							open the link in an <strong>incognito / private window</strong> if a different
							account is currently signed in (claude.ai offers no account chooser).
						</p>

						<!-- Step 1 -->
						<div class="onboard-step space-y-[var(--gw-space-3)]">
							<p class="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">
								Step 1 — Open the login page
							</p>
							<code class="url-code">{reUrl}</code>
							<div class="flex flex-wrap items-center gap-[var(--gw-space-2)]">
								<a href={reUrl} target="_blank" rel="noopener noreferrer" class="btn-ghost">
									<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
										stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
										<polyline points="15 3 21 3 21 9"/>
										<line x1="10" y1="14" x2="21" y2="3"/>
									</svg>
									Open link
								</a>
								<button type="button" class="btn-ghost" onclick={copyReloginLink}>
									{#if reCopied}
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
									bind:value={reCode}
									placeholder="Code from the login page"
									class="gw-input max-w-xs"
									disabled={reStep === 'completing'}
								/>
								<button
									type="button"
									class="cta flex-shrink-0"
									onclick={completeRelogin}
									disabled={reStep === 'completing'}
								>
									{#if reStep === 'completing'}
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

				{#if reErr}
					<p class="text-[var(--gw-text-xs)] text-[var(--gw-color-error)]">{reErr}</p>
				{/if}
			</div>
		</div>
	{/if}

</div>
