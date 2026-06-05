<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	// After the OAuth round-trip the backend lands us here with the access token
	// in a URL fragment (#access_token=…). The session is already established via
	// httpOnly cookies, so the token is redundant — strip the fragment so it does
	// not linger in the address bar or browser history.
	onMount(() => {
		if (location.hash.includes('access_token=')) {
			history.replaceState(history.state, '', location.pathname + location.search);
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
