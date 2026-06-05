<script lang="ts">
	import { page } from '$app/state';
	import { hasScope } from '$lib/api/auth';
	import type { Snippet } from 'svelte';

	interface Props {
		/** Scope required to render the children (e.g. "issues.write"). */
		scope: string;
		children: Snippet;
		fallback?: Snippet;
	}

	let { scope, children, fallback }: Props = $props();

	const ok = $derived(hasScope(page.data.user?.scopes, scope));
</script>

{#if ok}
	{@render children()}
{:else if fallback}
	{@render fallback()}
{/if}
