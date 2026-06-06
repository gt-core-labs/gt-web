<script lang="ts">
	import { ScopeGate } from '$lib/ui';
	import Terminal from '$lib/components/terminal/Terminal.svelte';
</script>

<div class="space-y-4">
	<header>
		<h1 class="h2">Terminal</h1>
		<p class="text-sm opacity-60">
			Shell interactiva en el servidor para operar agentes y cuentas (gt / gtmcp).
		</p>
	</header>

	<ScopeGate scope="terminal.exec">
		<Terminal />
		{#snippet fallback()}
			<p class="text-sm text-error-500">
				Necesitas el scope <code>terminal.exec</code> para abrir una terminal.
			</p>
		{/snippet}
	</ScopeGate>
</div>
