<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		class?: string;
		children: Snippet;
	}

	let { class: cls = '', children }: Props = $props();
</script>

<div class="card preset-filled-surface-100-900 p-4 {cls}">{@render children()}</div>
