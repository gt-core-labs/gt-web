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

<aside
	class="space-y-[var(--gw-space-2)] rounded-[var(--gw-radius-lg)] border border-[var(--gw-color-border-subtle)]
		bg-[var(--gw-color-surface-2)] p-[var(--gw-space-3)]"
>
	<header class="flex items-center gap-[var(--gw-space-2)]">
		<span
			class="inline-block h-2 w-2 rounded-[var(--gw-radius-full)]"
			class:animate-pulse={status === 'connecting'}
			style="background-color: {dotColor}"
		></span>
		<h2 class="text-[var(--gw-text-sm)] font-semibold text-[var(--gw-color-text)]">Live feed</h2>
		<span class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">{status}</span>
	</header>
	{#if events.length === 0}
		<p class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">Waiting for events…</p>
	{:else}
		<ul class="space-y-[var(--gw-space-1)] text-[var(--gw-text-xs)]">
			{#each events as e, i (e.ts + i)}
				<li class="flex items-center gap-[var(--gw-space-2)]">
					<Badge variant="primary">{e.kind}</Badge>
					<span class="truncate text-[var(--gw-color-text-muted)]">{e.data}</span>
				</li>
			{/each}
		</ul>
	{/if}
</aside>
