<script lang="ts">
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import { hasScope, switchWorkspace } from '$lib/api/auth';
	import { setActiveRig } from '$lib/rig';
	import TerminalDock from '$lib/components/terminal/TerminalDock.svelte';
	import NotificationBell from '$lib/components/NotificationBell.svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	// The floating terminal dock mounts here so it can hover over any view (hq-term-dock.2). Only
	// for a caller that can actually open a terminal.
	const canTerminal = $derived(hasScope(data.user?.scopes, 'terminal.exec'));

	let switching = $state(false);

	// Re-target the session to another workspace: the backend re-mints the cookies
	// (new scopes + tenant), then a hard reload re-runs SSR with the fresh session.
	async function onWorkspace(e: Event) {
		const slug = (e.currentTarget as HTMLSelectElement).value;
		if (!slug || slug === data.user?.workspace) return;
		switching = true;
		const res = await switchWorkspace(slug);
		if (res.ok) location.reload();
		else switching = false;
	}

	// Selecting a rig is a pure UI preference (cookie); re-run loads so views that
	// read `activeRig` (tracker filter, spawn default) pick it up. No reload needed.
	async function onRig(e: Event) {
		setActiveRig((e.currentTarget as HTMLSelectElement).value);
		await invalidateAll();
	}

	type NavItem = { href: string; label: string; scope: string | null };
	const NAV: NavItem[] = [
		{ href: '/', label: 'Home', scope: null },
		{ href: '/tracker', label: 'Tracker', scope: 'issues.read' },
		{ href: '/orchestration', label: 'Orchestration', scope: 'agent.read' },
		{ href: '/terminal', label: 'Terminal', scope: 'terminal.exec' },
		{ href: '/knowledge', label: 'Knowledge', scope: 'documents.read' },
		{ href: '/hooks', label: 'Hooks', scope: 'hooks.write' },
		{ href: '/stats', label: 'Statistics', scope: 'issues.read' },
		{ href: '/security', label: 'Security', scope: 'tokens.read' },
		{ href: '/admin/users', label: 'Users', scope: 'users.read' },
		{ href: '/admin/workspaces', label: 'Workspaces', scope: 'workspace.read' },
		{ href: '/admin/rigs', label: 'Rigs', scope: 'rig.read' },
		{ href: '/admin/quota', label: 'Quota', scope: 'quota.read' },
		{ href: '/admin/providers', label: 'Providers', scope: '*' },
		{ href: '/system', label: 'System', scope: 'system.read' },
		{ href: '/help', label: 'Help', scope: 'meta.read' }
	];

	const items = $derived(NAV.filter((i) => !i.scope || hasScope(data.user?.scopes, i.scope)));
	const path = $derived(page.url.pathname);
</script>

<div class="grid min-h-screen grid-cols-[14rem_1fr]">
	<Navbar {items} {path} />

	<div class="flex min-h-screen flex-col overflow-hidden">
		<!-- Top bar: workspace/rig context + user actions -->
		<header
			class="flex shrink-0 items-center justify-between
				border-b border-[var(--gw-color-border-subtle)]
				bg-[var(--gw-color-surface)]
				px-[var(--gw-space-6)] py-[var(--gw-space-3)]"
		>
			<div class="flex items-center gap-[var(--gw-space-3)]">
				{#if data.workspaces.length > 1}
					<select
						class="select select-sm w-44"
						aria-label="Workspace"
						disabled={switching}
						value={data.user?.workspace ?? ''}
						onchange={onWorkspace}
					>
						{#each data.workspaces as ws (ws.workspace)}
							<option value={ws.workspace}>{ws.workspace} · {ws.role}</option>
						{/each}
					</select>
				{:else}
					<span class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">
						{data.user?.workspace ?? ''}
					</span>
				{/if}

				{#if data.rigs.length === 1}
					<span class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">
						{data.rigs[0].name}
					</span>
				{:else if data.rigs.length > 1}
					<select
						class="select select-sm w-40"
						aria-label="Rig"
						value={data.activeRig}
						onchange={onRig}
					>
						<option value="">All rigs</option>
						{#each data.rigs as rig (rig.name)}
							<option value={rig.name}>{rig.name}</option>
						{/each}
					</select>
				{/if}
			</div>

			<div class="flex items-center gap-[var(--gw-space-4)]">
				<NotificationBell />
				<span class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">
					{data.user?.sub}
				</span>
				<form method="POST" action="/logout">
					<button type="submit" class="btn btn-sm preset-tonal-surface">Logout</button>
				</form>
			</div>
		</header>

		<main class="flex-1 overflow-auto p-[var(--gw-space-6)]">
			{@render children()}
		</main>
	</div>
</div>

{#if canTerminal}
	<TerminalDock />
{/if}
