<script lang="ts">
	import { Icon } from '$lib/ui';

	type NavItem = { href: string; label: string; scope: string | null; icon?: string };

	interface Props {
		items: NavItem[];
		path: string;
	}

	let { items, path }: Props = $props();

	const isActive = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));

	// Items whose href belongs to admin/system/security/help surfaces
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

<!--
  App sidebar navigation.  Uses --gw-* design tokens throughout; no raw
  colour literals or magic spacing values.
-->
<aside
	class="flex flex-col border-r border-[var(--gw-color-border-subtle)] bg-[var(--gw-color-surface-2)]"
>
	<!-- Brand mark -->
	<a
		href="/"
		class="flex shrink-0 items-center gap-[var(--gw-space-3)]
			border-b border-[var(--gw-color-border-subtle)]
			px-[var(--gw-space-4)] py-[var(--gw-space-4)]
			no-underline"
		aria-label="gt-web home"
	>
		<span
			class="flex h-7 w-7 shrink-0 items-center justify-center
				rounded-[var(--gw-radius-md)]
				bg-[var(--gw-color-primary)]
				text-[var(--gw-text-xs)] font-bold leading-none text-white"
		>gt</span>
		<span
			class="text-[var(--gw-text-sm)] font-semibold
				tracking-tight text-[var(--gw-color-text)]"
		>gt-web</span>
	</a>

	<!-- Nav items -->
	<nav
		class="flex flex-1 flex-col gap-[var(--gw-space-1)]
			overflow-y-auto p-[var(--gw-space-3)]"
		aria-label="Main navigation"
	>
		{#each mainItems as item (item.href)}
			{@const active = isActive(item.href)}
			<a
				href={item.href}
				aria-current={active ? 'page' : undefined}
				class="relative flex items-center rounded-[var(--gw-radius-md)]
					px-[var(--gw-space-3)] py-[var(--gw-space-2)]
					text-[var(--gw-text-sm)] no-underline
					transition-colors duration-[var(--gw-duration-fast)]
					focus-visible:outline-none focus-visible:ring-2
					focus-visible:ring-[var(--gw-color-primary-focus)] focus-visible:ring-offset-1
					{active
						? 'preset-tonal-primary font-medium text-[var(--gw-color-primary)]'
						: 'text-[var(--gw-color-text-muted)] hover:bg-[var(--gw-color-surface-3)] hover:text-[var(--gw-color-text)]'}"
			>
				{#if active}
					<span
						aria-hidden="true"
						class="absolute left-0 top-1/2 h-4 w-[3px]
							-translate-y-1/2 rounded-r-full
							bg-[var(--gw-color-primary)]"
					></span>
				{/if}
				<span class="flex items-center gap-[var(--gw-space-2)] pl-[var(--gw-space-1)]">
					{#if item.icon}<Icon icon={item.icon} size={16} />{/if}
					{item.label}
				</span>
			</a>
		{/each}

		{#if adminItems.length > 0}
			<!-- Admin section divider -->
			<div
				class="mt-[var(--gw-space-3)] mb-[var(--gw-space-1)]
					flex items-center gap-[var(--gw-space-2)]
					px-[var(--gw-space-3)]"
			>
				<span
					class="text-[0.65rem] font-semibold uppercase
						leading-none tracking-widest
						text-[var(--gw-color-text-muted)] opacity-60"
				>Admin</span>
				<div class="h-px flex-1 bg-[var(--gw-color-border-subtle)]"></div>
			</div>

			{#each adminItems as item (item.href)}
				{@const active = isActive(item.href)}
				<a
					href={item.href}
					aria-current={active ? 'page' : undefined}
					class="relative flex items-center rounded-[var(--gw-radius-md)]
						px-[var(--gw-space-3)] py-[var(--gw-space-2)]
						text-[var(--gw-text-sm)] no-underline
						transition-colors duration-[var(--gw-duration-fast)]
						focus-visible:outline-none focus-visible:ring-2
						focus-visible:ring-[var(--gw-color-primary-focus)] focus-visible:ring-offset-1
						{active
							? 'preset-tonal-primary font-medium text-[var(--gw-color-primary)]'
							: 'text-[var(--gw-color-text-muted)] hover:bg-[var(--gw-color-surface-3)] hover:text-[var(--gw-color-text)]'}"
				>
					{#if active}
						<span
							aria-hidden="true"
							class="absolute left-0 top-1/2 h-4 w-[3px]
								-translate-y-1/2 rounded-r-full
								bg-[var(--gw-color-primary)]"
						></span>
					{/if}
					<span class="pl-[var(--gw-space-1)]">{item.label}</span>
				</a>
			{/each}
		{/if}
	</nav>
</aside>
