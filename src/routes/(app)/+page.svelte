<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function reveal(node: HTMLElement, delayMs = 0) {
		node.style.setProperty('--reveal-delay', `${delayMs}ms`);
		const io = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					node.classList.add('is-revealed');
					io.disconnect();
				}
			},
			{ threshold: 0.06 }
		);
		io.observe(node);
		return { destroy: () => io.disconnect() };
	}
</script>

<div class="mx-auto max-w-3xl px-2 py-10 md:py-16">

	<!-- ── Greeting ──────────────────────────────────────────────────────────── -->
	<header class="reveal-entry mb-12" use:reveal>
		<span class="mb-4 block w-fit rounded-full border border-[var(--gw-color-border)] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--gw-color-text-muted)]">
			Dashboard
		</span>
		<h1 class="text-4xl font-bold leading-tight tracking-tight text-[var(--gw-color-text)] sm:text-5xl">
			Welcome back,<br />
			<span class="text-[var(--gw-color-primary)]">{data.user?.sub}</span>
		</h1>
	</header>

	<!-- ── Session card (Double-Bezel) ───────────────────────────────────────── -->
	<div class="reveal-entry" use:reveal={90}>
		<!-- Outer shell -->
		<div class="rounded-[1.75rem] border border-[var(--gw-color-border)] bg-[var(--gw-color-border)]/20 p-[3px]">
			<!-- Inner core -->
			<div class="rounded-[calc(1.75rem-3px)] bg-[var(--gw-color-surface)] px-6 py-7 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] sm:px-8">

				<div class="mb-6 flex items-center gap-3">
					<h2 class="text-sm font-semibold tracking-tight text-[var(--gw-color-text)]">Session</h2>
					<span class="rounded-full bg-[var(--gw-color-success)]/10 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--gw-color-success)]">
						authenticated
					</span>
				</div>

				<dl class="grid grid-cols-[6rem_1fr] gap-x-4 gap-y-4 sm:grid-cols-[8rem_1fr]">
					<dt class="self-start pt-0.5 text-xs text-[var(--gw-color-text-muted)]">User</dt>
					<dd class="text-sm font-medium text-[var(--gw-color-text)]">{data.user?.sub}</dd>

					<dt class="self-start pt-0.5 text-xs text-[var(--gw-color-text-muted)]">Workspace</dt>
					<dd class="text-sm font-medium text-[var(--gw-color-text)]">{data.user?.workspace}</dd>

					<dt class="self-start pt-1 text-xs text-[var(--gw-color-text-muted)]">Scopes</dt>
					<dd>
						<div class="flex flex-wrap gap-1.5">
							{#each data.user?.scopes ?? [] as s (s)}
								<span class="inline-flex items-center rounded-full border border-[var(--gw-color-border)] bg-[var(--gw-color-surface-3)] px-2.5 py-0.5 font-mono text-[10px] text-[var(--gw-color-text-muted)]">
									{s}
								</span>
							{/each}
						</div>
					</dd>
				</dl>

			</div>
		</div>
	</div>

</div>

<style>
	.reveal-entry {
		opacity: 0;
		transform: translateY(16px);
		transition:
			opacity 0.65s cubic-bezier(0.32, 0.72, 0, 1) var(--reveal-delay, 0ms),
			transform 0.65s cubic-bezier(0.32, 0.72, 0, 1) var(--reveal-delay, 0ms);
	}
	:global(.reveal-entry.is-revealed) {
		opacity: 1;
		transform: translateY(0);
	}
</style>
