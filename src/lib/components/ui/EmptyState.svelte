<script lang="ts">
	import type { Snippet } from 'svelte';

	// Designed empty placeholder for lists/sections with no data (gw-ui-redesign.3).
	// Dashed token-driven frame + glyph + copy, with an optional action slot.
	interface Props {
		title: string;
		description?: string;
		/** Glyph/emoji shown in the medallion. */
		icon?: string;
		/** Optional action area (e.g. a primary Button). */
		children?: Snippet;
	}

	let { title, description, icon = '◇', children }: Props = $props();
</script>

<div
	class="flex flex-col items-center justify-center gap-[var(--gw-space-3)]
		rounded-[var(--gw-radius-lg)] border border-dashed border-[var(--gw-color-border-subtle)]
		bg-[var(--gw-color-surface-2)]
		px-[var(--gw-space-6)] py-[var(--gw-space-10)] text-center"
>
	<span
		aria-hidden="true"
		class="flex h-12 w-12 items-center justify-center rounded-[var(--gw-radius-full)]
			bg-[var(--gw-color-surface-3)] text-[var(--gw-text-xl)] text-[var(--gw-color-text-muted)]"
	>{icon}</span>
	<div class="space-y-[var(--gw-space-1)]">
		<p class="text-[var(--gw-text-base)] font-semibold text-[var(--gw-color-text)]">{title}</p>
		{#if description}
			<p class="max-w-sm text-[var(--gw-text-sm)] leading-[var(--gw-leading-normal)] text-[var(--gw-color-text-muted)]">
				{description}
			</p>
		{/if}
	</div>
	{#if children}
		<div class="mt-[var(--gw-space-1)]">{@render children()}</div>
	{/if}
</div>
