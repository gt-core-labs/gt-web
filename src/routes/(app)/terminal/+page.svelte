<script lang="ts">
	import { page } from '$app/stores';
	import { ScopeGate } from '$lib/ui';
	import Terminal from '$lib/components/terminal/Terminal.svelte';

	// ?session=<id> attaches the terminal to that agent's tmux (read-only) so an operator can
	// watch what the agent is doing live (hq-agent-observability.6); without it, a fresh shell.
	const session = $derived($page.url.searchParams.get('session') ?? undefined);
	// ?write=1 makes it interactive attach-or-create (hq-session-terminal.2) so a spawned session
	// with no tmux yet gets a real shell to communicate with.
	const write = $derived($page.url.searchParams.get('write') === '1');
</script>

<div class="space-y-4">
	<header>
		<h1 class="h2">Terminal</h1>
		<p class="text-sm opacity-60">
			{#if session}
				Adjunto a la sesión del agente <code>{session}</code>{write ? ' (interactivo)' : ' (solo lectura)'}.
			{:else}
				Shell interactiva en el servidor para operar agentes y cuentas (gt / gtmcp).
			{/if}
		</p>
	</header>

	<ScopeGate scope="terminal.exec">
		{#key `${session}:${write}`}
			<Terminal {session} {write} />
		{/key}
		{#snippet fallback()}
			<p class="text-sm text-error-500">
				Necesitas el scope <code>terminal.exec</code> para abrir una terminal.
			</p>
		{/snippet}
	</ScopeGate>
</div>
