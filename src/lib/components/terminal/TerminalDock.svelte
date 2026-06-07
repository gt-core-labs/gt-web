<script lang="ts">
	// Floating terminal dock (hq-term-dock.2, design ported from gastown).
	//
	// A fixed bottom-right panel with one tab per open session. Opened on demand from the
	// Orchestration session row (`terminals.open(id)`), so it floats over any view instead of
	// navigating to /terminal. Each tab owns its own xterm + WebSocket via the existing
	// Terminal component, attached interactively (write) to that session's tmux. Hidden entirely
	// when no tab is open.
	import Terminal from './Terminal.svelte';
	import { terminals } from '$lib/stores/terminals.svelte';

	let collapsed = $state(false);
</script>

{#if terminals.ids.length > 0}
	<section
		class="card preset-filled-surface-100-900 fixed bottom-0 right-4 z-50 flex w-[42rem] max-w-[calc(100vw-2rem)] flex-col border border-surface-500/30 shadow-xl"
		style={collapsed ? '' : 'height: 24rem'}
		aria-label="Terminal dock"
	>
		<!-- Tab strip + dock controls -->
		<header class="flex shrink-0 items-center gap-1 border-b border-surface-500/20 px-2 py-1">
			<span class="mr-1 font-mono text-[10px] opacity-50">term</span>
			<div class="flex flex-1 flex-wrap items-center gap-1 overflow-hidden">
				{#each terminals.ids as id (id)}
					{@const active = terminals.active === id}
					<span
						class="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px]"
						class:preset-tonal-primary={active}
						class:border-primary-500={active}
						class:border-surface-500={!active}
						class:opacity-60={!active}
					>
						<button type="button" onclick={() => terminals.focus(id)}>{id}</button>
						<button
							type="button"
							class="opacity-60 hover:opacity-100"
							aria-label="Close terminal {id}"
							onclick={() => terminals.close(id)}>×</button
						>
					</span>
				{/each}
			</div>
			<button
				type="button"
				class="btn btn-sm preset-tonal-surface px-2 py-0.5 text-xs"
				onclick={() => (collapsed = !collapsed)}
			>
				{collapsed ? '▢' : '—'}
			</button>
			<button
				type="button"
				class="btn btn-sm preset-tonal-surface px-2 py-0.5 text-xs"
				aria-label="Close dock"
				onclick={() => terminals.reset()}>×</button
			>
		</header>

		{#if !collapsed}
			<div class="min-h-0 flex-1 bg-black">
				{#if terminals.active}
					<!-- Remount per active tab: each session owns its own xterm + WebSocket, so the
						sessionId prop can't be swapped on a live instance. -->
					{#key terminals.active}
						<Terminal session={terminals.active} write />
					{/key}
				{/if}
			</div>
		{/if}
	</section>
{/if}
