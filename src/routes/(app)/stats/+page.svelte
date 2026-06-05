<script lang="ts">
	import { Badge, Card } from '$lib/ui';
	import type { StatBucket } from '$lib/api/stats';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const current = $derived(data.user?.workspace ?? '');

	function pct(b: StatBucket) {
		return Math.round(b.progress_pct);
	}
	function bucketLabel(b: StatBucket) {
		const vals = Object.values(b.key);
		return vals.length ? vals.join(' / ') : '—';
	}
	function hms(secs?: number) {
		if (secs == null) return '—';
		const h = Math.floor(secs / 3600);
		const m = Math.round((secs % 3600) / 60);
		return h > 0 ? `${h}h ${m}m` : `${m}m`;
	}
</script>

<div class="space-y-5">
	<header class="flex flex-wrap items-center justify-between gap-3">
		<h1 class="h2">Statistics</h1>
		<form method="POST" action="?/switch" class="flex items-center gap-2">
			<span class="text-sm opacity-60">workspace</span>
			<select name="workspace" class="select w-44" onchange={(e) => e.currentTarget.form?.requestSubmit()}>
				{#each data.workspaces as w (w.workspace)}
					<option value={w.workspace} selected={w.workspace === current}>{w.workspace} ({w.role})</option>
				{/each}
			</select>
			<noscript><button class="btn preset-tonal-surface btn-sm" type="submit">Switch</button></noscript>
		</form>
	</header>

	{#if data.error}<p class="text-sm text-error-500">{data.error}</p>{/if}

	{#if data.stats}
		{@const t = data.stats.totals}
		<Card>
			<div class="flex flex-wrap items-center gap-4">
				<div>
					<div class="text-3xl font-semibold">{pct(t)}%</div>
					<div class="text-xs opacity-60">{t.closed}/{t.total} closed</div>
				</div>
				<div class="flex gap-2">
					<Badge variant="surface">open {t.open}</Badge>
					<Badge variant="warning">working {t.working}</Badge>
					<Badge variant="success">closed {t.closed}</Badge>
				</div>
				<div class="text-sm opacity-70">
					lead-time: mean {hms(t.lead_time.mean_secs)} · median {hms(t.lead_time.median_secs)} ({t.lead_time.count})
				</div>
			</div>
		</Card>

		<nav class="flex flex-wrap gap-1 border-b border-surface-500/20">
			{#each data.groups as g (g)}
				<a
					href={`?group_by=${g}`}
					class="px-3 py-2 text-sm"
					class:border-b-2={g === data.groupBy}
					class:border-primary-500={g === data.groupBy}
					class:opacity-60={g !== data.groupBy}
				>
					{g}
				</a>
			{/each}
		</nav>

		<table class="table">
			<thead>
				<tr>
					<th>{data.groupBy}</th><th>Progress</th><th>Open</th><th>Working</th><th>Closed</th><th>Total</th><th>Lead (mean)</th>
				</tr>
			</thead>
			<tbody>
				{#each data.stats.buckets as b (bucketLabel(b))}
					<tr>
						<td class="font-mono text-xs">{bucketLabel(b)}</td>
						<td>
							<div class="flex items-center gap-2">
								<div class="h-2 w-24 overflow-hidden rounded bg-surface-500/20">
									<div class="h-full bg-primary-500" style={`width:${pct(b)}%`}></div>
								</div>
								<span class="text-xs">{pct(b)}%</span>
							</div>
						</td>
						<td>{b.open}</td>
						<td>{b.working}</td>
						<td>{b.closed}</td>
						<td>{b.total}</td>
						<td class="text-xs">{hms(b.lead_time.mean_secs)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{:else if !data.error}
		<p class="opacity-60">No statistics available.</p>
	{/if}
</div>
