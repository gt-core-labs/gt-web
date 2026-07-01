<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { afterNavigate, invalidateAll } from '$app/navigation';
	import { hasScope, switchWorkspace } from '$lib/api/auth';
	import { setActiveRig } from '$lib/rig';
	import { theme } from '$lib/stores/theme.svelte';
	import TerminalDock from '$lib/components/terminal/TerminalDock.svelte';
	import NotificationBell from '$lib/components/NotificationBell.svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import { ThemeToggle } from '$lib/components/ui';
	import { Icon } from '$lib/ui';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	// Context-switch toast (hq-203db0): rig switches toast immediately; a
	// workspace switch hard-reloads, so the message rides sessionStorage and
	// shows after the reload.
	const TOAST_KEY = 'gt:ctx-toast';
	let toast = $state<string | null>(null);
	let toastTimer: ReturnType<typeof setTimeout> | undefined;

	function showToast(msg: string) {
		toast = msg;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = null), 3500);
	}

	onMount(() => {
		theme.init();
		try {
			const pending = sessionStorage.getItem(TOAST_KEY);
			if (pending) {
				sessionStorage.removeItem(TOAST_KEY);
				showToast(pending);
			}
		} catch {
			/* storage may be unavailable (private mode) */
		}
		// Restore last used board view so the Navbar entry lands there, not always /planning.
		try {
			const saved = localStorage.getItem('gt:board-view');
			if (saved && BOARD_HREF_MAP[saved]) boardHref = BOARD_HREF_MAP[saved];
		} catch {
			/* storage unavailable */
		}
	});

	// Keep boardHref in sync as the user switches views via the ViewSwitcher.
	afterNavigate(({ to }) => {
		if (!to) return;
		const p = to.url.pathname;
		if (p.startsWith('/kanban')) boardHref = '/kanban';
		else if (p.startsWith('/calendar')) boardHref = to.url.href.includes('mode=timeline') ? '/calendar?mode=timeline' : '/calendar?mode=month';
		else if (p.startsWith('/planning')) boardHref = '/planning';
	});

	const canTerminal = $derived(hasScope(data.user?.scopes, 'terminal.exec'));

	let switching = $state(false);

	async function onWorkspace(e: Event) {
		const slug = (e.currentTarget as HTMLSelectElement).value;
		if (!slug || slug === data.user?.workspace) return;
		switching = true;
		const res = await switchWorkspace(slug);
		if (res.ok) {
			try {
				sessionStorage.setItem(TOAST_KEY, `Workspace: ${slug}`);
			} catch {
				/* storage may be unavailable */
			}
			location.reload();
		} else switching = false;
	}

	async function onRig(e: Event) {
		const rig = (e.currentTarget as HTMLSelectElement).value;
		setActiveRig(rig);
		await invalidateAll();
		showToast(`Rig: ${rig || 'All rigs'}`);
	}

	// Board section: Navbar entry that covers all four view routes and remembers
	// the last used one (kanban/planning/calendar/timeline) via localStorage.
	const BOARD_ROUTES = ['/kanban', '/planning', '/calendar'];
	const BOARD_HREF_MAP: Record<string, string> = {
		kanban: '/kanban',
		planning: '/planning',
		calendar: '/calendar?mode=month',
		timeline: '/calendar?mode=timeline'
	};
	let boardHref = $state('/planning');

	type NavItem = { href: string; label: string; scope: string | null; icon: string; matchPaths?: string[] };
	const NAV: NavItem[] = [
		{ href: '/', label: 'Home', scope: null, icon: 'lucide:home' },
		// Board projections — href tracks the last used view; all board routes
		// keep this item highlighted (matchPaths covers kanban/planning/calendar).
		{ href: boardHref, label: 'Planning', scope: 'issues.read', icon: 'lucide:calendar-range', matchPaths: BOARD_ROUTES },
		{ href: '/analytics', label: 'Analytics', scope: 'issues.read', icon: 'lucide:line-chart' },
		{ href: '/orchestration', label: 'Orchestration', scope: 'agent.read', icon: 'lucide:workflow' },
		{ href: '/agents', label: 'Agents', scope: 'tokens.read', icon: 'lucide:bot' },
		{ href: '/terminal', label: 'Terminal', scope: 'terminal.exec', icon: 'lucide:terminal' },
		{ href: '/knowledge', label: 'Knowledge', scope: 'documents.read', icon: 'lucide:book-open' },
		{ href: '/complementos', label: 'Add-ons', scope: 'connection.read', icon: 'lucide:puzzle' },
		// Rigs (repos) per workspace — the CRUD lives in the GitHub complemento (Repos zone); this
		// item is the direct entry, scoped to the active workspace (switch in the header to change it).
		{ href: '/rigs', label: 'Rigs', scope: 'rig.read', icon: 'lucide:git-branch' },
		{ href: '/hooks', label: 'Hooks', scope: 'hooks.write', icon: 'lucide:webhook' },
		{ href: '/security', label: 'Security', scope: 'tokens.read', icon: 'lucide:shield' },
		{ href: '/admin/users', label: 'Users', scope: 'users.read', icon: 'lucide:users' },
		{ href: '/admin/workspaces', label: 'Workspaces', scope: 'workspace.read', icon: 'lucide:layout-grid' },
		// Rigs CRUD lives in the GitHub complemento (/complementos/github); the "Rigs" item above
		// links straight to it. /admin/rigs is a legacy 308 redirect to the same place.
		{ href: '/admin/quota', label: 'Quota', scope: 'quota.read', icon: 'lucide:gauge' },
		{ href: '/admin/providers', label: 'Providers', scope: '*', icon: 'lucide:plug' },
		{ href: '/system', label: 'System', scope: 'system.read', icon: 'lucide:cpu' },
		{ href: '/help', label: 'Help', scope: 'meta.read', icon: 'lucide:circle-help' }
	];

	const items = $derived(
		NAV
			.filter((i) => !i.scope || hasScope(data.user?.scopes, i.scope))
			.map((i) => (i.matchPaths ? { ...i, href: boardHref } : i))
	);
	const path = $derived(page.url.pathname);
</script>

<!--
  Shell: sidebar (fixed width, scales up on xl) + main column.
  grid-cols breakpoints: default 14rem · xl 16rem · 2xl 18rem
-->
<div class="grid min-h-screen grid-cols-[14rem_1fr] xl:grid-cols-[16rem_1fr] 2xl:grid-cols-[18rem_1fr]">

	<Navbar {items} {path} />

	<div class="flex min-h-screen flex-col overflow-hidden">

		<!-- ── Top header bar ─────────────────────────────────────────────────── -->
		<header class="flex h-14 shrink-0 items-center justify-between border-b border-[var(--gw-color-border)] bg-[var(--gw-color-surface)] px-5 xl:px-7">

			<!-- Left: workspace · rig context -->
			<div class="flex items-center gap-2 text-sm">
				{#if data.workspaces.length > 1}
					<div class="ctx-wrap has-ico">
						<Icon icon="lucide:layout-grid" size={14} class="ctx-ico" />
						<select
							class="ctx-select"
							aria-label="Workspace"
							disabled={switching}
							value={data.user?.workspace ?? ''}
							onchange={onWorkspace}
						>
							{#each data.workspaces as ws (ws.workspace)}
								<option value={ws.workspace}>{ws.workspace} · {ws.role}</option>
							{/each}
						</select>
					</div>
				{:else}
					<span class="font-medium text-[var(--gw-color-text)]">{data.user?.workspace ?? ''}</span>
				{/if}

				{#if data.rigs.length === 1}
					<span class="text-[var(--gw-color-border)]">·</span>
					<span class="text-[var(--gw-color-text-muted)]">{data.rigs[0].name}</span>
				{:else if data.rigs.length > 1}
					<span class="text-[var(--gw-color-border)]">·</span>
					<div class="ctx-wrap has-ico">
						<Icon icon="lucide:git-branch" size={14} class="ctx-ico" />
						<select
							class="ctx-select"
							aria-label="Rig"
							value={data.activeRig}
							onchange={onRig}
						>
							<option value="">All rigs</option>
							{#each data.rigs as rig (rig.name)}
								<option value={rig.name}>{rig.name}</option>
							{/each}
						</select>
					</div>
				{/if}
			</div>

			<!-- Right: actions -->
			<div class="flex items-center gap-1.5">
				<ThemeToggle />
				<NotificationBell />
				<span class="hidden px-1 text-xs text-[var(--gw-color-text-muted)] sm:block">
					{data.user?.sub}
				</span>
				<form method="POST" action="/logout">
					<button type="submit" class="logout-btn">Logout</button>
				</form>
			</div>

		</header>

		<!-- ── Persistent relogin notice (gtweb-a3a05b) ───────────────────────────
		     Shown whenever ≥1 claude account needs an operator relogin/revision
		     (count from the SSR layout load). It is NOT dismissable: it reflects
		     server state, so it stays while count>0 and vanishes once all are healthy
		     on the next load/navigation. The whole bar links to /admin/quota. -->
		{#if (data.needsReloginCount ?? 0) > 0}
			<a
				href="{base}/admin/quota"
				class="relogin-banner"
				aria-label="{data.needsReloginCount} claude account{data.needsReloginCount === 1 ? '' : 's'} need re-login — open Quota admin"
			>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
					stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
					<line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
				</svg>
				<span>
					<strong>{data.needsReloginCount}</strong>
					claude account{data.needsReloginCount === 1 ? '' : 's'}
					{data.needsReloginCount === 1 ? 'needs' : 'need'} re-login — review in Quota
				</span>
				<span class="relogin-banner-arrow" aria-hidden="true">→</span>
			</a>
		{/if}

		<!-- ── Main content ───────────────────────────────────────────────────── -->
		<main class="flex-1 overflow-auto p-6 xl:p-8 2xl:p-10">
			{@render children()}
		</main>

	</div>
</div>

{#if toast}
	<div
		class="fixed right-5 bottom-5 z-[60] flex items-center gap-2 rounded-xl border border-[var(--gw-color-border)] bg-[var(--gw-color-surface)] px-4 py-2.5 text-sm shadow-lg"
		role="status"
		aria-live="polite"
	>
		<span class="h-2 w-2 shrink-0 rounded-full bg-emerald-500"></span>
		{toast}
	</div>
{/if}

{#if canTerminal}
	<TerminalDock />
{/if}

<style>
	/* Context selects (workspace / rig) — pill-shaped, minimal */
	.ctx-wrap {
		position: relative;
		border-radius: 9999px;
		border: 1px solid var(--gw-color-border);
		background: var(--gw-color-surface-2);
		transition: border-color 0.25s cubic-bezier(0.32, 0.72, 0, 1);
	}
	.ctx-wrap:focus-within {
		border-color: var(--gw-color-primary);
	}
	/* Leading glyph (workspace / rig) — sits inside the pill; the <select> gets
	   matching left padding via `.has-ico` so the value never overlaps it. The
	   icon renders from a child component, so reach it with :global. */
	.ctx-wrap :global(.ctx-ico) {
		position: absolute;
		top: 50%;
		left: 0.65rem;
		transform: translateY(-50%);
		color: var(--gw-color-text-muted);
		pointer-events: none;
	}
	.ctx-select {
		display: block;
		background: transparent;
		border: none;
		outline: none;
		padding: 0.2rem 0.75rem;
		font-size: 0.8125rem;
		color: var(--gw-color-text);
		cursor: pointer;
		border-radius: 9999px;
	}
	.ctx-wrap.has-ico .ctx-select {
		padding-left: 1.85rem;
	}

	/* Logout — ghost pill */
	.logout-btn {
		border-radius: 9999px;
		border: 1px solid var(--gw-color-border);
		padding: 0.2rem 0.75rem;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--gw-color-text-muted);
		background: transparent;
		cursor: pointer;
		transition: all 0.25s cubic-bezier(0.32, 0.72, 0, 1);
	}
	.logout-btn:hover {
		border-color: var(--gw-color-text-muted);
		color: var(--gw-color-text);
	}
	.logout-btn:active {
		transform: scale(0.97);
	}
	.logout-btn:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--gw-color-primary-focus);
	}

	/* Persistent relogin notice (gtweb-a3a05b) — amber, matches the quota page's
	   warn palette. A full-width bar under the header; the whole bar is the link. */
	.relogin-banner {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		gap: 0.5rem;
		border-bottom: 1px solid oklch(88% 0.1 80);
		background-color: oklch(97% 0.04 80);
		color: oklch(48% 0.18 80);
		font-size: var(--gw-text-xs);
		font-weight: 500;
		padding: 0.4375rem 1.25rem;
		text-decoration: none;
		transition: background-color 150ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.relogin-banner:hover {
		background-color: oklch(95% 0.05 80);
	}
	.relogin-banner svg {
		flex-shrink: 0;
	}
	.relogin-banner strong {
		font-weight: 700;
	}
	.relogin-banner-arrow {
		margin-left: auto;
		font-size: var(--gw-text-sm);
		transition: transform 150ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.relogin-banner:hover .relogin-banner-arrow {
		transform: translateX(2px);
	}
</style>
