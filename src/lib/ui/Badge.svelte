<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'primary' | 'success' | 'warning' | 'error' | 'surface';
		class?: string;
		/** Adds hover + focus ring for interactive/clickable badges. */
		interactive?: boolean;
		/** Dims the badge. */
		disabled?: boolean;
		children: Snippet;
	}

	let { variant = 'surface', class: cls = '', interactive = false, disabled = false, children }: Props = $props();
</script>

<span
	class="badge preset-tonal-{variant}
		transition-opacity duration-[var(--gw-duration-fast)]
		{interactive
			? 'cursor-pointer hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gw-color-primary-focus)] focus-visible:ring-offset-1'
			: ''}
		{disabled ? 'cursor-not-allowed opacity-40' : ''}
		{cls}"
	role={interactive ? 'button' : undefined}
	tabindex={interactive ? 0 : undefined}
	aria-disabled={disabled || undefined}
>{@render children()}</span>
