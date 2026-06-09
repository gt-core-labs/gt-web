<script lang="ts">
	// Floating terminal dock (hq-term-dock.2/.3).
	// Full-width bottom bar with one tab per open session, drag-resizable from the top edge.
	import Terminal from './Terminal.svelte';
	import { terminals } from '$lib/stores/terminals.svelte';

	let collapsed = $state(false);
	let height = $state(320);
	const MIN = 140;
	const max = () => (typeof window !== 'undefined' ? window.innerHeight - 80 : 800);

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
		class="fixed bottom-0 left-0 right-0 z-50 flex flex-col
			border-t border-[var(--gw-color-border)]
			bg-[var(--gw-color-surface-2)]
			shadow-[0_-4px_24px_-4px_rgba(0,0,0,0.12)]"
		aria-label="Terminal dock"
	>
		<!-- Resize handle -->
		<div
			class="group flex h-2 w-full shrink-0 cursor-row-resize items-center justify-center
				transition-colors duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]
				{dragging ? 'bg-[var(--gw-color-primary)]/20' : 'hover:bg-[var(--gw-color-primary)]/10'}"
			role="separator"
			aria-orientation="horizontal"
			aria-label="Resize terminal dock"
			onpointerdown={startResize}
			onpointermove={onMove}
			onpointerup={endResize}
		>
			<!-- Drag grip indicator -->
			<div class="flex gap-0.5 opacity-30 transition-opacity group-hover:opacity-60 {dragging ? 'opacity-80' : ''}">
				{#each [0,1,2] as _}
					<div class="h-[3px] w-[3px] rounded-full bg-[var(--gw-color-text-muted)]"></div>
				{/each}
			</div>
		</div>

		<!-- Tab strip + dock controls -->
		<header class="flex shrink-0 items-center gap-2 border-b border-[var(--gw-color-border)] px-3 py-1.5">
			<!-- "term" label -->
			<span class="mr-1 shrink-0 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--gw-color-text-muted)]/50">
				term
			</span>

			<!-- Tabs -->
			<div class="flex flex-1 flex-wrap items-center gap-1 overflow-hidden">
				{#each terminals.ids as id (id)}
					{@const active = terminals.active === id}
					<div
						class="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[11px]
							transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]
							{active
								? 'border-[var(--gw-color-primary)]/40 bg-[var(--gw-color-primary)]/10 text-[var(--gw-color-primary)]'
								: 'border-[var(--gw-color-border)] text-[var(--gw-color-text-muted)] hover:text-[var(--gw-color-text)]'}"
					>
						<button type="button" class="focus-visible:outline-none" onclick={() => terminals.focus(id)}>
							{id}
						</button>
						<button
							type="button"
							class="flex h-3.5 w-3.5 items-center justify-center rounded-full opacity-40 transition-all duration-200 hover:bg-current/10 hover:opacity-80"
							aria-label="Close terminal {id}"
							onclick={() => terminals.close(id)}
						>
							<svg width="7" height="7" viewBox="0 0 8 8" fill="none" aria-hidden="true">
								<path d="M1 1L7 7M7 1L1 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
							</svg>
						</button>
					</div>
				{/each}
			</div>

			<!-- Dock controls -->
			<div class="flex shrink-0 items-center gap-1">
				<!-- Collapse / expand -->
				<button
					type="button"
					class="flex h-6 w-6 items-center justify-center rounded-md text-[var(--gw-color-text-muted)]
						transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]
						hover:bg-[var(--gw-color-surface-3)] hover:text-[var(--gw-color-text)]
						focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gw-color-primary-focus)]"
					aria-label={collapsed ? 'Expand dock' : 'Collapse dock'}
					onclick={() => (collapsed = !collapsed)}
				>
					{#if collapsed}
						<svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
							<path d="M1.5 6.5L5 3L8.5 6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
					{:else}
						<svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
							<path d="M1.5 3.5L5 7L8.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
					{/if}
				</button>
				<!-- Close dock -->
				<button
					type="button"
					class="flex h-6 w-6 items-center justify-center rounded-md text-[var(--gw-color-text-muted)]
						transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]
						hover:bg-[var(--color-error-500)]/10 hover:text-[var(--color-error-500)]
						focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gw-color-primary-focus)]"
					aria-label="Close all terminals"
					onclick={() => terminals.reset()}
				>
					<svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
						<path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
					</svg>
				</button>
			</div>
		</header>

		{#if !collapsed}
			<div class="min-h-0 bg-[#0b0f17]" style="height: {height}px">
				{#if terminals.active}
					{#key terminals.active}
						<Terminal session={terminals.active} write fill />
					{/key}
				{/if}
			</div>
		{/if}
	</section>
{/if}
