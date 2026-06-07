<script lang="ts">
	import { onMount } from 'svelte';
	import { hasScope } from '$lib/api/auth';
	import { Badge, Button, Card } from '$lib/ui';
	import { TrackerError } from '$lib/api/tracker';
	import { browserHooks, EVENT_TYPES, type Hook } from '$lib/api/hooks';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const canWrite = $derived(hasScope(data.user?.scopes, 'hooks.write'));

	let list = $state<Hook[]>([]);
	let loading = $state(true);
	let error = $state('');
	let busy = $state(false);

	// A new hook. The id is server-generated (not entered here). matcher empty ⇒ every invocation of
	// the event. Target CSV fields: empty ⇒ "all".
	let form = $state({
		event: 'PreToolUse' as string,
		matcher: '',
		command: '',
		workspaces_csv: '',
		rigs_csv: '',
		roles_csv: ''
	});

	const csv = (s: string) =>
		s
			.split(',')
			.map((x) => x.trim())
			.filter((x) => x.length > 0);

	async function refresh() {
		loading = true;
		error = '';
		try {
			list = await browserHooks().list();
		} catch (err) {
			error = err instanceof TrackerError ? `${err.status}: ${err.message}` : String(err);
		} finally {
			loading = false;
		}
	}

	onMount(refresh);

	async function run(fn: () => Promise<unknown>) {
		error = '';
		busy = true;
		try {
			await fn();
			await refresh();
		} catch (err) {
			error = err instanceof TrackerError ? `${err.status}: ${err.message}` : String(err);
		} finally {
			busy = false;
		}
	}

	async function register(e: SubmitEvent) {
		e.preventDefault();
		await run(async () => {
			await browserHooks().register({
				event: form.event,
				matcher: form.matcher.trim(),
				command: form.command,
				target: {
					workspaces: csv(form.workspaces_csv),
					rigs: csv(form.rigs_csv),
					roles: csv(form.roles_csv)
				}
			});
			form.matcher = '';
			form.command = '';
			form.workspaces_csv = '';
			form.rigs_csv = '';
			form.roles_csv = '';
		});
	}

	const retire = (id: string) => run(() => browserHooks().retire(id));

	// Group hooks by event for a readable, claude-settings.json-shaped listing.
	const byEvent = $derived.by(() => {
		const m = new Map<string, Hook[]>();
		for (const h of list) {
			if (!m.has(h.event)) m.set(h.event, []);
			m.get(h.event)!.push(h);
		}
		return m;
	});

	const dim = (xs: string[]) => (xs.length === 0 ? 'all' : xs.join(', '));
</script>

<div class="flex flex-col gap-6 p-6">
	<header class="flex flex-col gap-1">
		<h1 class="h3">Hooks</h1>
		<p class="text-sm opacity-70">
			Global Claude Code hooks. Each is materialised into a session's
			<code>.claude/settings.json</code> when its target matches the session's workspace / rig /
			role (empty dimension = all). Seeded with the dangerous-command safety guards.
		</p>
	</header>

	{#if error}
		<div class="card preset-tonal-error p-3 text-sm">{error}</div>
	{/if}

	{#if canWrite}
		<Card>
			<form class="flex flex-col gap-3 p-4" onsubmit={register}>
				<h2 class="h5">New hook</h2>
				<p class="text-xs opacity-60">The id is generated automatically.</p>
				<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
					<label class="label">
						<span class="text-xs opacity-70">Event</span>
						<select class="select" bind:value={form.event}>
							{#each EVENT_TYPES as ev (ev)}
								<option value={ev}>{ev}</option>
							{/each}
						</select>
					</label>
					<label class="label">
						<span class="text-xs opacity-70">Matcher (empty = all)</span>
						<input class="input" bind:value={form.matcher} placeholder="Bash(rm -rf /*)" />
					</label>
				</div>
				<label class="label">
					<span class="text-xs opacity-70">Command</span>
					<input
						class="input font-mono"
						bind:value={form.command}
						placeholder="echo '❌ BLOCKED' && exit 2"
						required
					/>
				</label>
				<div class="grid grid-cols-1 gap-3 md:grid-cols-3">
					<label class="label">
						<span class="text-xs opacity-70">Workspaces (csv, empty = all)</span>
						<input class="input" bind:value={form.workspaces_csv} placeholder="acme, beta" />
					</label>
					<label class="label">
						<span class="text-xs opacity-70">Rigs (csv, empty = all)</span>
						<input class="input" bind:value={form.rigs_csv} placeholder="hq" />
					</label>
					<label class="label">
						<span class="text-xs opacity-70">Roles (csv, empty = all)</span>
						<input class="input" bind:value={form.roles_csv} placeholder="witness, polecat" />
					</label>
				</div>
				<div><Button type="submit" disabled={busy}>Register hook</Button></div>
			</form>
		</Card>
	{/if}

	{#if loading}
		<p class="text-sm opacity-70">Loading…</p>
	{:else if list.length === 0}
		<p class="text-sm opacity-70">No hooks registered.</p>
	{:else}
		{#each [...byEvent] as [event, hooks] (event)}
			<Card>
				<div class="flex flex-col gap-2 p-4">
					<div class="flex items-center gap-2">
						<Badge>{event}</Badge>
						<span class="text-xs opacity-60">{hooks.length}</span>
					</div>
					<table class="table">
						<thead>
							<tr>
								<th>Id</th>
								<th>Matcher</th>
								<th>Command</th>
								<th>Workspaces</th>
								<th>Rigs</th>
								<th>Roles</th>
								{#if canWrite}<th></th>{/if}
							</tr>
						</thead>
						<tbody>
							{#each hooks as h (h.id)}
								<tr>
									<td class="font-mono text-xs">{h.id}</td>
									<td class="font-mono text-xs">{h.matcher || '∗'}</td>
									<td class="font-mono text-xs">{h.command}</td>
									<td class="text-xs">{dim(h.target.workspaces)}</td>
									<td class="text-xs">{dim(h.target.rigs)}</td>
									<td class="text-xs">{dim(h.target.roles)}</td>
									{#if canWrite}
										<td>
											<Button variant="tonal" disabled={busy} onclick={() => retire(h.id)}>
												Retire
											</Button>
										</td>
									{/if}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</Card>
		{/each}
	{/if}
</div>
