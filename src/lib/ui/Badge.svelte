<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'primary' | 'success' | 'warning' | 'error' | 'surface';
		class?: string;
		children: Snippet;
	}

	let { variant = 'surface', class: cls = '', children }: Props = $props();
</script>

<span class="badge preset-tonal-{variant} {cls}">{@render children()}</span>
