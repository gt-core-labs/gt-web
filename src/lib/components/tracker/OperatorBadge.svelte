<script lang="ts">
	import { Badge } from '$lib/ui';
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

<div class="flex flex-wrap items-center gap-1 text-xs" data-testid="operator-badge">
	<Badge variant="primary">▶ {operator.role}</Badge>
	<span class="font-mono opacity-70">{operator.session}</span>
	<!-- Open a read-only terminal attached to the agent's tmux session, so the operator watches
		what it is doing live (hq-agent-observability.6). -->
	<a
		href={`/terminal?session=${encodeURIComponent(operator.session)}`}
		class="opacity-70 hover:opacity-100"
		title="Abrir terminal del agente (solo lectura)"
		aria-label="Abrir terminal del agente"
	>
		🖥
	</a>
	{#if !compact}
		{#each operator.skills as skill (skill)}
			<Badge variant="surface">{skill}</Badge>
		{/each}
		{#each operator.hooks as hook (hook)}
			<Badge variant="surface" class="opacity-60">⛓ {hook}</Badge>
		{/each}
	{/if}
</div>
