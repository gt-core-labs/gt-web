<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import { hasScope, switchWorkspace } from '$lib/api/auth';
	import { setActiveRig } from '$lib/rig';
	import { theme } from '$lib/stores/theme.svelte';
	import TerminalDock from '$lib/components/terminal/TerminalDock.svelte';
	import NotificationBell from '$lib/components/NotificationBell.svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import { ThemeToggle } from '$lib/components/ui';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	onMount(() => theme.init());

	const canTerminal = $derived(hasScope(data.user?.scopes, 'terminal.exec'));

	let switching = $state(false);

	async function onWorkspace(e: Event) {
		const slug = (e.currentTarget as HTMLSelectElement).value;
		if (!slug || slug === data.user?.workspace) return;
		switching = true;
		const res = await switchWorkspace(slug);
		if (res.ok) location.reload();
		else switching = false;
	}

	async function onRig(e: Event) {
		setActiveRig((e.currentTarget as HTMLSelectElement).value);
		await invalidateAll();
	}

	type NavItem = { href: string; label: string; scope: string | null; icon: string };
	const NAV: NavItem[] = [
		{ href: '/', label: 'Home', scope: null, icon: 'lucide:home' },
		{ href: '/tracker', label: 'Tracker', scope: 'issues.read', icon: 'lucide:list-todo' },
		{ href: '/orchestration', label: 'Orchestration', scope: 'agent.read', icon: 'lucide:workflow' },
		{ href: '/terminal', label: 'Terminal', scope: 'terminal.exec', icon: 'lucide:terminal' },
		{ href: '/knowledge', label: 'Knowledge', scope: 'documents.read', icon: 'lucide:book-open' },
		{ href: '/hooks', label: 'Hooks', scope: 'hooks.write', icon: 'lucide:webhook' },
		{ href: '/stats', label: 'Statistics', scope: 'issues.read', icon: 'lucide:bar-chart-3' },
		{ href: '/security', label: 'Security', scope: 'tokens.read', icon: 'lucide:shield' },
		{ href: '/admin/users', label: 'Users', scope: 'users.read', icon: 'lucide:users' },
		{ href: '/admin/workspaces', label: 'Workspaces', scope: 'workspace.read', icon: 'lucide:layout-grid' },
		{ href: '/admin/rigs', label: 'Rigs', scope: 'rig.read', icon: 'lucide:server' },
		{ href: '/admin/quota', label: 'Quota', scope: 'quota.read', icon: 'lucide:gauge' },
		{ href: '/admin/providers', label: 'Providers', scope: '*', icon: 'lucide:plug' },
		{ href: '/system', label: 'System', scope: 'system.read', icon: 'lucide:cpu' },
		{ href: '/help', label: 'Help', scope: 'meta.read', icon: 'lucide:circle-help' }
	];

	const items = $derived(NAV.filter((i) => !i.scope || hasScope(data.user?.scopes, i.scope)));
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
					<div class="ctx-wrap">
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
					<div class="ctx-wrap">
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

		<!-- ── Main content ───────────────────────────────────────────────────── -->
		<main class="flex-1 overflow-auto p-6 xl:p-8 2xl:p-10">
			{@render children()}
		</main>

	</div>
</div>

{#if canTerminal}
	<TerminalDock />
{/if}

<style>
	/* Context selects (workspace / rig) — pill-shaped, minimal */
	.ctx-wrap {
		border-radius: 9999px;
		border: 1px solid var(--gw-color-border);
		background: var(--gw-color-surface-2);
		transition: border-color 0.25s cubic-bezier(0.32, 0.72, 0, 1);
	}
	.ctx-wrap:focus-within {
		border-color: var(--gw-color-primary);
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
</style>
