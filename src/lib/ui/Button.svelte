<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		variant?: 'filled' | 'tonal' | 'outlined';
		class?: string;
		children: Snippet;
	}

	let { variant = 'filled', class: cls = '', children, ...rest }: Props = $props();

	const preset = {
		filled: 'preset-filled-primary-500',
		tonal: 'preset-tonal-primary',
		outlined: 'preset-outlined-primary-500'
	} as const;
</script>

<button
	class="btn {preset[variant]}
		transition-opacity duration-[var(--gw-duration-fast)]
		hover:opacity-90
		focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gw-color-primary-focus)] focus-visible:ring-offset-1
		disabled:cursor-not-allowed disabled:opacity-40
		{cls}"
	{...rest}
>{@render children()}</button>
