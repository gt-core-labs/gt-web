<script lang="ts">
	import type { IssueOperator } from '$lib/api/tracker';

	// The agent operating a bead (hq-agent-observability.4): role + session, plus the skills and
	// hooks it has loaded, rendered as chips. Shown on a working bead's card + detail; absent when
	// no agent is on the bead. The live `issues.operated/cleared` SSE events refresh it.
	interface Props {
		operator: IssueOperator;
		/** Detail view shows the skills/hooks chips; the compact card view omits them to stay terse. */
		compact?: boolean;
	}

	let { operator, compact = false }: Props = $props();
</script>

<div class="flex flex-wrap items-center gap-1.5" data-testid="operator-badge">

	<!-- Role pill -->
	<span class="inline-flex items-center gap-1 rounded-full bg-[var(--gw-color-primary)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--gw-color-primary)]">
		<span aria-hidden="true" class="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--gw-color-primary)]"></span>
		{operator.role}
	</span>

	<!-- Session id -->
	<span class="rounded-md bg-[var(--gw-color-surface-3)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--gw-color-text-muted)]">
		{operator.session}
	</span>

	<!-- Terminal link -->
	<a
		href={`/terminal?session=${encodeURIComponent(operator.session)}`}
		class="inline-flex h-5 w-5 items-center justify-center rounded-md border border-[var(--gw-color-border)]
			text-[var(--gw-color-text-muted)]
			transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]
			hover:border-[var(--gw-color-primary)]/40 hover:bg-[var(--gw-color-primary)]/8 hover:text-[var(--gw-color-primary)]
			focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gw-color-primary-focus)]"
		title="Abrir terminal del agente (solo lectura)"
		aria-label="Abrir terminal del agente"
	>
		<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
			<path d="M1.5 2.5L4.5 5L1.5 7.5M5 7.5H8.5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>
		</svg>
	</a>

	{#if !compact}
		{#each operator.skills as skill (skill)}
			<span class="inline-flex items-center rounded-full border border-[var(--gw-color-border)] bg-[var(--gw-color-surface-3)] px-2 py-0.5 text-[10px] text-[var(--gw-color-text-muted)]">
				{skill}
			</span>
		{/each}
		{#each operator.hooks as hook (hook)}
			<span class="inline-flex items-center rounded-full border border-[var(--gw-color-border)]/50 px-2 py-0.5 text-[10px] text-[var(--gw-color-text-muted)] opacity-70">
				⛓ {hook}
			</span>
		{/each}
	{/if}
</div>
