<script lang="ts">
	import { Icon } from '$lib/ui';

	type NavItem = { href: string; label: string; scope: string | null; icon?: string; matchPaths?: string[] };

	interface Props {
		items: NavItem[];
		path: string;
	}

	let { items, path }: Props = $props();

	// Segment-boundary match: `/rigs` must not light up for `/rigsomething`, and a
	// sub-route (e.g. `/admin/users/123`) keeps its parent item active. Home is exact.
	// matchPaths lets a single nav item cover multiple routes (e.g. the board section).
	const segmentMatch = (href: string) =>
		href === '/' ? path === '/' : path === href || path.startsWith(href + '/');
	const isActive = (item: NavItem) =>
		item.matchPaths ? item.matchPaths.some(segmentMatch) : segmentMatch(item.href);

	const ADMIN_HREFS = new Set([
		'/security',
		'/admin/users',
		'/admin/workspaces',
		'/admin/rigs',
		'/admin/quota',
		'/admin/providers',
		'/system',
		'/help'
	]);

	const mainItems = $derived(items.filter((i) => !ADMIN_HREFS.has(i.href)));
	const adminItems = $derived(items.filter((i) => ADMIN_HREFS.has(i.href)));
</script>

<aside class="flex flex-col border-r border-[var(--gw-color-border)] bg-[var(--gw-color-surface-2)]">

	<!-- Brand mark -->
	<a
		href="/"
		class="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--gw-color-border)] px-4 no-underline
			transition-opacity duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:opacity-80
			focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gw-color-primary-focus)] focus-visible:ring-offset-1"
		aria-label="gt-web home"
	>
		<!-- Logo — outer shell + inner core (Double-Bezel mini) -->
		<div class="rounded-[10px] border border-[var(--gw-color-primary)]/25 bg-[var(--gw-color-primary)]/10 p-[2px]">
			<div class="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[var(--gw-color-primary)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
				<span class="text-[11px] font-bold leading-none tracking-tight text-white">gt</span>
			</div>
		</div>
		<span class="text-sm font-semibold tracking-tight text-[var(--gw-color-text)]">gt-web</span>
	</a>

	<!-- Nav items -->
	<nav
		class="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3"
		aria-label="Main navigation"
	>
		{#each mainItems as item (item.href)}
			{@const active = isActive(item)}
			<a
				href={item.href}
				aria-current={active ? 'page' : undefined}
				class="group relative flex items-center rounded-xl px-3 py-2.5 text-sm no-underline
					transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
					focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gw-color-primary-focus)] focus-visible:ring-offset-1
					{active
						? 'bg-[var(--gw-color-primary)]/10 font-semibold text-[var(--gw-color-primary)]'
						: 'text-[var(--gw-color-text-muted)] hover:bg-[var(--gw-color-surface-3)] hover:text-[var(--gw-color-text)]'}"
			>
				<!-- Indicator stays mounted across navigations and fades in/out, so it
				     never re-mounts (no jump/flicker) when the active item changes. -->
				<span
					aria-hidden="true"
					class="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--gw-color-primary)]
						transition-opacity duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
						{active ? 'opacity-100' : 'opacity-0'}"
				></span>
				<span class="flex items-center gap-2.5 pl-1">
					{#if item.icon}
						<!-- Active: icon sits in a filled primary chip (white glyph, bezel
						     inset like the brand mark) for an unmistakable "you are here".
						     Inactive: flat muted glyph in the same 24px box (no jump). -->
						<span
							class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg
								transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
								{active
									? 'bg-[var(--gw-color-primary)] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]'
									: 'group-hover:translate-x-px'}"
						>
							<Icon icon={item.icon} size={15} />
						</span>
					{/if}
					{item.label}
				</span>
			</a>
		{/each}

		{#if adminItems.length > 0}
			<!-- Admin divider -->
			<div class="mb-1 mt-4 flex items-center gap-2 px-3">
				<span class="text-[0.625rem] font-semibold uppercase leading-none tracking-widest text-[var(--gw-color-text-muted)]/50">
					Admin
				</span>
				<div class="h-px flex-1 bg-[var(--gw-color-border)]"></div>
			</div>

			{#each adminItems as item (item.href)}
				{@const active = isActive(item)}
				<a
					href={item.href}
					aria-current={active ? 'page' : undefined}
					class="group relative flex items-center rounded-xl px-3 py-2.5 text-sm no-underline
						transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
						focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gw-color-primary-focus)] focus-visible:ring-offset-1
						{active
							? 'bg-[var(--gw-color-primary)]/10 font-semibold text-[var(--gw-color-primary)]'
							: 'text-[var(--gw-color-text-muted)] hover:bg-[var(--gw-color-surface-3)] hover:text-[var(--gw-color-text)]'}"
				>
					<!-- Same always-mounted, opacity-faded indicator as the main items. -->
					<span
						aria-hidden="true"
						class="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--gw-color-primary)]
							transition-opacity duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
							{active ? 'opacity-100' : 'opacity-0'}"
					></span>
					<span class="flex items-center gap-2.5 pl-1">
						{#if item.icon}
							<!-- Same active-chip treatment as the main items. -->
							<span
								class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg
									transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
									{active
										? 'bg-[var(--gw-color-primary)] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]'
										: 'group-hover:translate-x-px'}"
							>
								<Icon icon={item.icon} size={15} />
							</span>
						{/if}
						{item.label}
					</span>
				</a>
			{/each}
		{/if}
	</nav>
</aside>
