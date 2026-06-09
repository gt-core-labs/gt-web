<script lang="ts">
	import { page } from '$app/stores';
	import { ScopeGate } from '$lib/ui';
	import Terminal from '$lib/components/terminal/Terminal.svelte';

	// ?session=<id> attaches the terminal to that agent's tmux session (read-only) so an operator can
	// watch what the agent is doing live (hq-agent-observability.6); without it, a fresh shell.
	const session = $derived($page.url.searchParams.get('session') ?? undefined);
	// ?write=1 makes it interactive attach-or-create (hq-session-terminal.2)
	const write = $derived($page.url.searchParams.get('write') === '1');
</script>

<div class="mx-auto max-w-5xl xl:max-w-6xl 2xl:max-w-7xl flex flex-col gap-8">

	<!-- ── Header ─────────────────────────────────────────────────────────────── -->
	<header class="flex flex-col gap-4">
		<span class="w-fit rounded-full border border-[var(--gw-color-border)] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--gw-color-text-muted)]">
			{session ? 'Agent session' : 'Shell'}
		</span>
		<div class="flex flex-col gap-2">
			<h1 class="text-4xl font-bold tracking-tight leading-none text-[var(--gw-color-text)] xl:text-5xl">
				Terminal
			</h1>
			<p class="text-sm leading-relaxed text-[var(--gw-color-text-muted)]">
				{#if session}
					Adjunto a la sesión del agente
					<code class="inline-flex items-center rounded-md bg-[var(--gw-color-surface-3)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--gw-color-text)]">{session}</code>
					<span class="ml-1 rounded-full border border-[var(--gw-color-border)] px-2 py-0.5 text-[10px]">{write ? 'interactivo' : 'solo lectura'}</span>
				{:else}
					Shell interactiva en el servidor para operar agentes y cuentas
					<code class="inline-flex items-center rounded-md bg-[var(--gw-color-surface-3)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--gw-color-text)]">gt / gtmcp</code>.
				{/if}
			</p>
		</div>
	</header>

	<!-- ── Terminal ───────────────────────────────────────────────────────────── -->
	<ScopeGate scope="terminal.exec">
		{#key `${session}:${write}`}
			<Terminal {session} {write} />
		{/key}
		{#snippet fallback()}
			<div class="rounded-2xl border border-[var(--color-error-500)]/30 bg-[var(--color-error-500)]/8 px-5 py-4 text-sm text-[var(--color-error-500)]">
				Necesitas el scope
				<code class="mx-1 rounded-md bg-[var(--color-error-500)]/10 px-1.5 py-0.5 font-mono text-[11px]">terminal.exec</code>
				para abrir una terminal.
			</div>
		{/snippet}
	</ScopeGate>

</div>
