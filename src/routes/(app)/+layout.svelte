<script lang="ts">
	import { page } from '$app/state';
	import { hasScope } from '$lib/api/auth';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	type NavItem = { href: string; label: string; scope: string | null };
	const NAV: NavItem[] = [
		{ href: '/', label: 'Home', scope: null },
		{ href: '/tracker', label: 'Tracker', scope: 'issues.read' },
		{ href: '/orchestration', label: 'Orchestration', scope: 'agent.read' },
		{ href: '/knowledge', label: 'Knowledge', scope: 'documents.read' },
		{ href: '/stats', label: 'Statistics', scope: 'issues.read' },
		{ href: '/security', label: 'Security', scope: 'tokens.read' },
		{ href: '/admin/users', label: 'Users', scope: 'users.read' },
		{ href: '/admin/workspaces', label: 'Workspaces', scope: 'workspace.read' },
		{ href: '/admin/rigs', label: 'Rigs', scope: 'rig.read' },
		{ href: '/admin/quota', label: 'Quota', scope: 'quota.read' },
		{ href: '/admin/providers', label: 'Providers', scope: '*' },
		{ href: '/help', label: 'Help', scope: 'meta.read' }
	];

	const items = $derived(NAV.filter((i) => !i.scope || hasScope(data.user?.scopes, i.scope)));
	const path = $derived(page.url.pathname);
	const isActive = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));
</script>

<div class="grid min-h-screen grid-cols-[15rem_1fr]">
	<aside class="flex flex-col gap-4 border-r border-surface-500/20 bg-surface-100-900 p-4">
		<a href="/" class="h4">gt-web</a>
		<nav class="flex flex-col gap-1">
			{#each items as item (item.href)}
				<a
					href={item.href}
					class="rounded px-3 py-2 text-sm hover:preset-tonal-primary"
					class:preset-tonal-primary={isActive(item.href)}
				>
					{item.label}
				</a>
			{/each}
		</nav>
	</aside>

	<div class="flex flex-col">
		<header class="flex items-center justify-between border-b border-surface-500/20 px-6 py-3">
			<div class="text-sm opacity-70">{data.user?.workspace ?? ''}</div>
			<div class="flex items-center gap-3">
				<span class="text-sm">{data.user?.sub}</span>
				<form method="POST" action="/logout">
					<button type="submit" class="btn btn-sm preset-tonal-surface">Logout</button>
				</form>
			</div>
		</header>

		<main class="flex-1 overflow-auto p-6">
			{@render children()}
		</main>
	</div>
</div>
