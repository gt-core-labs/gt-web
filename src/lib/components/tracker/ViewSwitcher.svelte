<script lang="ts">
	/**
	 * Segmented view switcher (hq-039316, Plane-style): one grouped control of
	 * icon links over the board projections — Kanban / Planning / Calendar /
	 * Timeline. The active segment is highlighted.
	 *
	 * Active state subscribes to the `page` Svelte store so it always reflects
	 * the live URL — the store fires immediately on subscribe (initial value)
	 * and again on every SvelteKit navigation, regardless of whether this
	 * component was mounted before or after the transition.
	 */
	import { page } from '$app/stores';
	import { Icon } from '$lib/ui';

	function urlToActive(pathname: string, search: string): 'kanban' | 'planning' | 'calendar' | 'timeline' {
		if (pathname.startsWith('/calendar')) {
			return new URLSearchParams(search).get('mode') === 'timeline' ? 'timeline' : 'calendar';
		}
		if (pathname.startsWith('/planning')) return 'planning';
		if (pathname.startsWith('/kanban')) return 'kanban';
		return 'kanban';
	}

	let active = $state<'kanban' | 'planning' | 'calendar' | 'timeline'>('kanban');

	$effect(() => {
		return page.subscribe((p) => {
			active = urlToActive(p.url.pathname, p.url.search);
		});
	});

	/** Remember the chosen view (hq-039316) — pages restore it on bare loads. */
	const remember = (key: string) => {
		try {
			localStorage.setItem('gt:board-view', key);
		} catch {
			/* storage may be unavailable (private mode) */
		}
	};

	const VIEWS = [
		{ key: 'kanban', href: '/kanban', icon: 'lucide:kanban', label: 'Kanban' },
		{ key: 'planning', href: '/planning', icon: 'lucide:table-2', label: 'Planning' },
		{ key: 'calendar', href: '/calendar?mode=month', icon: 'lucide:calendar', label: 'Calendar' },
		{ key: 'timeline', href: '/calendar?mode=timeline', icon: 'lucide:chart-no-axes-gantt', label: 'Timeline' }
	] as const;
</script>

<div
	class="flex overflow-hidden rounded-lg border border-[var(--gw-color-border)]"
	role="group"
	aria-label="View"
>
	{#each VIEWS as v (v.key)}
		<a
			class="flex items-center p-1.5 transition-colors {active === v.key
				? 'bg-[var(--gw-color-primary)] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]'
				: 'text-[var(--gw-color-text-muted)] hover:bg-[var(--gw-color-surface-2)] hover:text-[var(--gw-color-text)]'} border-l border-[var(--gw-color-border)] first:border-l-0"
			href={v.href}
			title={v.label}
			aria-label="{v.label} view"
			aria-current={active === v.key ? 'page' : undefined}
			onclick={() => remember(v.key)}
		><Icon icon={v.icon} size={16} /></a>
	{/each}
</div>
