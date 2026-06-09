<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		class?: string;
		/** Adds hover + focus ring for clickable cards. */
		interactive?: boolean;
		/** Dims the card and blocks pointer events. */
		disabled?: boolean;
		children: Snippet;
	}

	let { class: cls = '', interactive = false, disabled = false, children }: Props = $props();
</script>

<div
	class="card preset-filled-surface-100-900 p-4
		transition-colors duration-[var(--gw-duration-fast)]
		{interactive
			? 'cursor-pointer hover:preset-tonal-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gw-color-primary-focus)] focus-visible:ring-offset-1'
			: ''}
		{disabled ? 'pointer-events-none opacity-50' : ''}
		{cls}"
	role={interactive ? 'button' : undefined}
	tabindex={interactive ? 0 : undefined}
	aria-disabled={disabled || undefined}
>{@render children()}</div>
