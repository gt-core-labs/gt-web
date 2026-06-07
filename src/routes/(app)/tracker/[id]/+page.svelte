<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { browserTracker, parseJsonArray, TrackerError, type IssueStatus } from '$lib/api/tracker';
	import { hasScope } from '$lib/api/auth';
	import { Badge, Button } from '$lib/ui';
	import OperatorBadge from '$lib/components/tracker/OperatorBadge.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const issue = $derived(data.issue);
	const canWrite = $derived(hasScope(data.user?.scopes, 'issues.write'));

	let error = $state('');
	let busy = $state(false);
	let commitSha = $state('');

	const domains = $derived(parseJsonArray(issue.domain_json));
	const deps = $derived(parseJsonArray(issue.depends_on_json));
	const surfaces = $derived(parseJsonArray(issue.surface_json));

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

	const transition = (target: IssueStatus) => run(() => browserTracker().transition(issue.id, target));
	const claim = () => run(() => browserTracker().claim(issue.id));
	const close = () => run(() => browserTracker().close(issue.id, commitSha ? { commit_sha: commitSha } : {}));
</script>

<div class="mx-auto max-w-3xl space-y-5">
	<a href="/tracker" class="text-sm opacity-70 hover:underline">← Tracker</a>

	<header class="space-y-2">
		<div class="flex items-center gap-2">
			<span class="font-mono text-sm opacity-70">{issue.id}</span>
			<Badge variant={issue.status === 'closed' ? 'success' : issue.status === 'working' ? 'warning' : 'surface'}>
				{issue.status}
			</Badge>
			<Badge variant="primary">P{issue.priority}</Badge>
			{#if issue.phase}<Badge variant="surface">{issue.phase}</Badge>{/if}
		</div>
		<h1 class="h2">{issue.title}</h1>
		<div class="flex flex-wrap gap-x-4 gap-y-1 text-sm opacity-70">
			<span>type: {issue.issue_type}</span>
			{#if issue.external_ref}<span>epic: {issue.external_ref}</span>{/if}
			<span>assignee: {issue.assignee ?? '—'}</span>
			<span>owner: {issue.owner || '—'}</span>
			<span>v{issue.version}</span>
		</div>
		<div class="flex flex-wrap gap-1">
			{#each domains as d (d)}<Badge variant="surface">{d}</Badge>{/each}
		</div>
		{#if issue.operated_by}
			<OperatorBadge operator={issue.operated_by} />
		{/if}
	</header>

	{#if canWrite}
		<section class="card preset-tonal-surface space-y-3 p-4">
			{#if error}<p class="text-sm text-error-500">{error}</p>{/if}
			<div class="flex flex-wrap items-center gap-2">
				{#if issue.status === 'open'}
					<Button disabled={busy} onclick={() => transition('working')}>Start (→ working)</Button>
					<Button variant="tonal" disabled={busy} onclick={claim}>Claim</Button>
				{:else if issue.status === 'working'}
					<Button variant="tonal" disabled={busy} onclick={() => transition('open')}>Stop (→ open)</Button>
				{:else}
					<Button variant="tonal" disabled={busy} onclick={() => transition('open')}>Reopen</Button>
				{/if}
			</div>
			{#if issue.status !== 'closed'}
				<div class="flex items-end gap-2">
					<label class="label flex-1">
						<span class="label-text">commit_sha (required if code surface)</span>
						<input class="input" bind:value={commitSha} placeholder="7+ hex" />
					</label>
					<Button disabled={busy} onclick={close}>Close</Button>
				</div>
			{/if}
		</section>
	{/if}

	{#snippet body(label: string, text: string)}
		{#if text}
			<section class="space-y-1">
				<h2 class="font-semibold opacity-80">{label}</h2>
				<pre class="card preset-filled-surface-100-900 whitespace-pre-wrap p-3 text-sm">{text}</pre>
			</section>
		{/if}
	{/snippet}

	{@render body('Description', issue.description)}
	{@render body('Design', issue.design)}
	{@render body('Acceptance criteria', issue.acceptance_criteria)}
	{@render body('Notes', issue.notes)}

	{#if deps.length || surfaces.length}
		<section class="grid grid-cols-2 gap-4 text-sm">
			{#if deps.length}
				<div>
					<h2 class="font-semibold opacity-80">Depends on</h2>
					<ul class="list-disc pl-5">
						{#each deps as d (d)}<li><a class="hover:underline" href={`/tracker/${d}`}>{d}</a></li>{/each}
					</ul>
				</div>
			{/if}
			{#if surfaces.length}
				<div>
					<h2 class="font-semibold opacity-80">Surface</h2>
					<ul class="list-disc pl-5 font-mono text-xs">
						{#each surfaces as s (s)}<li>{s}</li>{/each}
					</ul>
				</div>
			{/if}
		</section>
	{/if}
</div>
