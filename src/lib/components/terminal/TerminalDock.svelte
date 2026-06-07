<script lang="ts">
	// Floating terminal dock (hq-term-dock.2/.3, design ported from gastown).
	//
	// A full-width bottom bar with one tab per open session, mounted in the app shell so it hovers
	// over any view. Resizable: drag the top edge to change its height. Each tab runs the existing
	// Terminal component attached interactively (write) to that session's tmux. Hidden entirely when
	// no tab is open.
	import Terminal from './Terminal.svelte';
	import { terminals } from '$lib/stores/terminals.svelte';

	let collapsed = $state(false);
	let height = $state(320); // px body height, drag-resizable
	const MIN = 140;
	const max = () => (typeof window !== 'undefined' ? window.innerHeight - 80 : 800);

	// Drag the top edge to resize. Pointer capture so the drag tracks outside the handle; clamp to
	// [MIN, viewport-80].
	let dragging = $state(false);
	function startResize(e: PointerEvent) {
		dragging = true;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		e.preventDefault();
	}
	function onMove(e: PointerEvent) {
		if (!dragging) return;
		height = Math.max(MIN, Math.min(max(), window.innerHeight - e.clientY));
	}
	function endResize(e: PointerEvent) {
		dragging = false;
		(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
	}
</script>

{#if terminals.ids.length > 0}
	<section
		class="card preset-filled-surface-100-900 fixed bottom-0 left-0 right-0 z-50 flex flex-col border-t border-surface-500/30 shadow-2xl"
		aria-label="Terminal dock"
	>
		<!-- Resize handle: drag the top edge to change the dock height. -->
		<div
			class="h-1.5 w-full shrink-0 cursor-row-resize bg-surface-500/20 hover:bg-primary-500/40"
			class:bg-primary-500={dragging}
			role="separator"
			aria-orientation="horizontal"
			aria-label="Resize terminal dock"
			onpointerdown={startResize}
			onpointermove={onMove}
			onpointerup={endResize}
		></div>

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
			<div class="min-h-0 bg-black" style="height: {height}px">
				{#if terminals.active}
					<!-- Remount per active tab: each session owns its own xterm + WebSocket, so the
						sessionId prop can't be swapped on a live instance. -->
					{#key terminals.active}
						<Terminal session={terminals.active} write fill />
					{/key}
				{/if}
			</div>
		{/if}
	</section>
{/if}
