<script lang="ts">
	/**
	 * Segmented view switcher (hq-039316, Plane-style): one grouped control of
	 * icon links over the board projections — Kanban / Planning / Calendar /
	 * Timeline. The active segment is highlighted.
	 */
	import { Icon } from '$lib/ui';

	interface Props {
		active: 'kanban' | 'planning' | 'calendar' | 'timeline';
	}
	let { active }: Props = $props();

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
