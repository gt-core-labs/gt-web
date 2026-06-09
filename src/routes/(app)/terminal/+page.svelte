<script lang="ts">
	import { page } from '$app/stores';
	import { ScopeGate } from '$lib/ui';
	import { Alert } from '$lib/components/ui';
	import Terminal from '$lib/components/terminal/Terminal.svelte';

	// ?session=<id> attaches the terminal to that agent's tmux (read-only) so an operator can
	// watch what the agent is doing live (hq-agent-observability.6); without it, a fresh shell.
	const session = $derived($page.url.searchParams.get('session') ?? undefined);
	// ?write=1 makes it interactive attach-or-create (hq-session-terminal.2) so a spawned session
	// with no tmux yet gets a real shell to communicate with.
	const write = $derived($page.url.searchParams.get('write') === '1');
</script>

<div class="space-y-[var(--gw-space-4)]">
	<header class="space-y-[var(--gw-space-1)]">
		<h1 class="text-[var(--gw-text-2xl)] font-semibold tracking-tight text-[var(--gw-color-text)]">Terminal</h1>
		<p class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">
			{#if session}
				Adjunto a la sesión del agente
				<code class="rounded-[var(--gw-radius-sm)] bg-[var(--gw-color-surface-3)] px-[var(--gw-space-1)] font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)] text-[var(--gw-color-text)]">{session}</code>{write
					? ' (interactivo)'
					: ' (solo lectura)'}.
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
			<Alert variant="error">
				Necesitas el scope
				<code class="rounded-[var(--gw-radius-sm)] bg-[var(--gw-color-surface-3)] px-[var(--gw-space-1)] font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)]">terminal.exec</code>
				para abrir una terminal.
			</Alert>
		{/snippet}
	</ScopeGate>
</div>
