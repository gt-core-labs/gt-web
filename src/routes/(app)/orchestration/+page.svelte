<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { browserOrch } from '$lib/api/orch';
	import { TrackerError } from '$lib/api/tracker';
	import { hasScope } from '$lib/api/auth';
	import { Badge, Button } from '$lib/ui';
	import LiveFeed from '$lib/components/orchestration/LiveFeed.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type Tab = 'sessions' | 'merge' | 'quota';
	let tab = $state<Tab>('sessions');
	let error = $state('');
	let busy = $state(false);

	const canAgent = $derived(hasScope(data.user?.scopes, 'agent.write'));
	const canMerge = $derived(hasScope(data.user?.scopes, 'merge.write'));

	const TABS: { id: Tab; label: string; count: number }[] = $derived([
		{ id: 'sessions', label: 'Sessions', count: data.agents.length },
		{ id: 'merge', label: 'Merge', count: data.merges.length },
		{ id: 'quota', label: 'Quota', count: data.quotas.length }
	]);

	async function run(fn: () => Promise<unknown>) {
		busy = true;
		error = '';
		try {
			await fn();
			await invalidateAll();
		} catch (err) {
			error = err instanceof TrackerError ? `${err.status}: ${err.message}` : String(err);
		} finally {
			busy = false;
		}
	}

	const o = browserOrch();
	const stateVariant = (s: string) => {
		switch (s.toLowerCase()) {
			case 'working':
			case 'merging':
				return 'warning';
			case 'done':
			case 'merged':
			case 'healthy':
				return 'success';
			case 'killed':
			case 'failed':
				return 'error';
			default:
				return 'surface';
		}
	};
</script>

<div class="grid grid-cols-[1fr_18rem] gap-4">
	<div class="space-y-4">
		<header class="flex items-center justify-between">
			<h1 class="h2">Orchestration</h1>
		</header>

		<nav class="flex gap-1 border-b border-surface-500/20">
			{#each TABS as t (t.id)}
				<button
					class="px-3 py-2 text-sm"
					class:border-b-2={tab === t.id}
					class:border-primary-500={tab === t.id}
					class:opacity-60={tab !== t.id}
					onclick={() => (tab = t.id)}
				>
					{t.label} <span class="opacity-60">({t.count})</span>
				</button>
			{/each}
		</nav>

		{#if error}<p class="text-sm text-error-500">{error}</p>{/if}

		{#if tab === 'sessions'}
			{#if data.errors.agents}<p class="text-sm text-error-500">{data.errors.agents}</p>{/if}
			{#if data.agents.length === 0}
				<p class="opacity-60">No active sessions.</p>
			{:else}
				<table class="table">
					<thead>
						<tr><th>Session</th><th>Rig</th><th>Role</th><th>Crew</th><th>State</th><th></th></tr>
					</thead>
					<tbody>
						{#each data.agents as s (s.id)}
							<tr>
								<td class="font-mono text-xs">{s.id}</td>
								<td>{s.rig}</td>
								<td>{s.role}</td>
								<td>{s.crew ?? '—'}</td>
								<td><Badge variant={stateVariant(s.state)}>{s.state}</Badge></td>
								<td class="text-right">
									{#if canAgent}
										<Button variant="tonal" disabled={busy} onclick={() => run(() => o.endAgent(s.id))}>End</Button>
										<Button variant="tonal" disabled={busy} onclick={() => run(() => o.killAgent(s.id))}>Kill</Button>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		{:else if tab === 'merge'}
			{#if data.errors.merges}<p class="text-sm text-error-500">{data.errors.merges}</p>{/if}
			{#if data.merges.length === 0}
				<p class="opacity-60">Merge board empty.</p>
			{:else}
				<table class="table">
					<thead>
						<tr><th>Bead</th><th>Branch</th><th>State</th><th></th></tr>
					</thead>
					<tbody>
						{#each data.merges as m (m.bead)}
							<tr>
								<td class="font-mono text-xs">{m.bead}</td>
								<td class="font-mono text-xs">{m.branch}</td>
								<td><Badge variant={stateVariant(m.state)}>{m.state}</Badge></td>
								<td class="text-right">
									{#if canMerge}
										{#if m.state === 'Ready'}
											<Button variant="tonal" disabled={busy} onclick={() => run(() => o.startMerge(m.bead))}>Start</Button>
										{:else if m.state === 'Merging'}
											<Button variant="tonal" disabled={busy} onclick={() => run(() => o.completeMerge(m.bead))}>Complete</Button>
											<Button variant="tonal" disabled={busy} onclick={() => run(() => o.failMerge(m.bead))}>Fail</Button>
										{/if}
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		{:else}
			{#if data.errors.quotas}<p class="text-sm text-error-500">{data.errors.quotas}</p>{/if}
			{#if data.quotas.length === 0}
				<p class="opacity-60">No quota accounts.</p>
			{:else}
				<table class="table">
					<thead>
						<tr><th>Account</th><th>Status</th><th>Window</th><th>Consumed / Limit</th></tr>
					</thead>
					<tbody>
						{#each data.quotas as a (a.id)}
							<tr>
								<td class="font-mono text-xs">{a.id}</td>
								<td><Badge variant={stateVariant(a.status)}>{a.status}</Badge></td>
								<td>{a.window?.kind ?? '—'}</td>
								<td>{a.window ? `${Math.ceil(a.window.consumed)} / ${a.window.limit}` : '—'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		{/if}
	</div>

	<LiveFeed />
</div>
