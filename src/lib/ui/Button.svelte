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

<button class="btn {preset[variant]} {cls}" {...rest}>{@render children()}</button>
