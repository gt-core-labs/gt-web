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

	const dot = $derived(
		status === 'live' ? 'bg-success-500' : status === 'error' ? 'bg-error-500' : 'bg-warning-500'
	);
</script>

<aside class="card preset-tonal-surface space-y-2 p-3">
	<header class="flex items-center gap-2">
		<span class="inline-block h-2 w-2 rounded-full {dot}"></span>
		<h2 class="font-semibold">Live feed</h2>
		<span class="text-xs opacity-60">{status}</span>
	</header>
	{#if events.length === 0}
		<p class="text-sm opacity-60">Waiting for events…</p>
	{:else}
		<ul class="space-y-1 text-xs">
			{#each events as e, i (e.ts + i)}
				<li class="flex items-center gap-2">
					<Badge variant="primary">{e.kind}</Badge>
					<span class="truncate opacity-70">{e.data}</span>
				</li>
			{/each}
		</ul>
	{/if}
</aside>
