<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { ORCH_EVENT_KINDS } from '$lib/api/orch';
	import { Badge } from '$lib/ui';

	type FeedEvent = { kind: string; ts: string; data: string };

	let status = $state<'connecting' | 'live' | 'error'>('connecting');
	let events = $state<FeedEvent[]>([]);
	let timer: ReturnType<typeof setTimeout> | null = null;

	// Debounce data refresh: a burst of events triggers one invalidate.
	function scheduleRefresh() {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => invalidateAll(), 400);
	}

	$effect(() => {
		// EventSource carries the gt_web_token cookie (Path=/) for SSE auth — the
		// stream cannot read an Authorization header.
		const es = new EventSource('/stream', { withCredentials: true });
		es.onopen = () => (status = 'live');
		es.onerror = () => (status = 'error');

		const handler = (e: MessageEvent) => {
			events = [{ kind: e.type, ts: e.lastEventId, data: e.data }, ...events].slice(0, 50);
			scheduleRefresh();
		};
		// Events are named by kind; EventSource needs a listener per name.
		for (const k of ORCH_EVENT_KINDS) es.addEventListener(k, handler as EventListener);

		// When the browser tab regains focus the SSE may have been throttled or
		// silently dropped — force a data refresh so sessions spawned while the
		// tab was backgrounded (e.g. mayor launching polecats) become visible.
		const onVisible = () => {
			if (document.visibilityState === 'visible') scheduleRefresh();
		};
		document.addEventListener('visibilitychange', onVisible);

		// Fallback poll: if the SSE goes quiet (no events), refresh every 30s so
		// the sessions list never goes stale for more than half a minute.
		const poll = setInterval(() => invalidateAll(), 30_000);

		return () => {
			es.close();
			document.removeEventListener('visibilitychange', onVisible);
			clearInterval(poll);
			if (timer) clearTimeout(timer);
		};
	});

	const dotColor = $derived(
		status === 'live'
			? 'var(--gw-color-success)'
			: status === 'error'
				? 'var(--gw-color-error)'
				: 'var(--gw-color-warning)'
	);
</script>

<style>
	@keyframes event-slide-in {
		from {
			opacity: 0;
			transform: translateY(-5px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.event-item {
		animation: event-slide-in 220ms cubic-bezier(0.32, 0.72, 0, 1) both;
	}

	.feed-shell {
		border-radius: 1.125rem;
		border: 1px solid var(--gw-color-border-subtle);
		background-color: var(--gw-color-surface-3);
		padding: 3px;
	}

	.feed-inner {
		border-radius: calc(1.125rem - 3px);
		background-color: var(--gw-color-surface);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
		overflow: hidden;
	}
</style>

<aside class="sticky top-4">
	<div class="feed-shell">
		<div class="feed-inner">

			<!-- Header -->
			<header
				class="flex items-center gap-[var(--gw-space-2)]
					border-b border-[var(--gw-color-border-subtle)]
					px-[var(--gw-space-4)] py-[var(--gw-space-3)]"
			>
				<!-- Animated status indicator -->
				<span class="relative inline-flex h-2.5 w-2.5 shrink-0">
					{#if status === 'live'}
						<span
							class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-40"
							style="background-color: {dotColor}"
						></span>
					{/if}
					<span
						class="relative inline-flex h-2.5 w-2.5 rounded-full"
						class:animate-pulse={status === 'connecting'}
						style="background-color: {dotColor}"
					></span>
				</span>

				<h2 class="flex-1 text-[var(--gw-text-sm)] font-semibold text-[var(--gw-color-text)]">
					Live feed
				</h2>

				<span
					class="rounded-full border border-[var(--gw-color-border-subtle)]
						bg-[var(--gw-color-surface-3)]
						px-[var(--gw-space-2)] py-[2px]
						text-[10px] font-medium text-[var(--gw-color-text-muted)]"
				>
					{status}
				</span>
			</header>

			<!-- Event feed -->
			<div class="max-h-[calc(100vh-14rem)] overflow-y-auto p-[var(--gw-space-3)]">
				{#if events.length === 0}
					<p class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">
						Waiting for events…
					</p>
				{:else}
					<ul class="space-y-[var(--gw-space-1)] text-[var(--gw-text-xs)]">
						{#each events as e, i (e.ts + i)}
							<li class="event-item flex items-start gap-[var(--gw-space-2)]">
								<Badge variant="primary" class="mt-px shrink-0">{e.kind}</Badge>
								<span class="truncate text-[var(--gw-color-text-muted)]">{e.data}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

		</div>
	</div>
</aside>
