<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { browserTracker, parseJsonArray, TrackerError, type IssueStatus } from '$lib/api/tracker';
	import { hasScope } from '$lib/api/auth';
	import { Badge, Button, Input } from '$lib/ui';
	import { Alert, Spinner } from '$lib/components/ui';
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

	const statusVariant = $derived(
		issue.status === 'closed' ? 'success' : issue.status === 'working' ? 'warning' : 'surface'
	);

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

<div class="mx-auto max-w-3xl space-y-[var(--gw-space-6)]">
	<a
		href="/tracker"
		class="inline-flex items-center gap-[var(--gw-space-1)]
			text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)] no-underline
			transition-colors duration-[var(--gw-duration-fast)] hover:text-[var(--gw-color-text)]
			focus-visible:outline-none focus-visible:ring-2
			focus-visible:ring-[var(--gw-color-primary-focus)] focus-visible:ring-offset-1"
	>
		<span aria-hidden="true">←</span> Tracker
	</a>

	<!-- Identity header: meta badges, then the title as the dominant element. -->
	<header class="space-y-[var(--gw-space-3)]">
		<div class="flex flex-wrap items-center gap-[var(--gw-space-2)]">
			<span class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">
				{issue.id}
			</span>
			<Badge variant={statusVariant}>{issue.status}</Badge>
			<span
				class="inline-flex items-center rounded-[var(--gw-radius-sm)]
					px-[var(--gw-space-2)] py-px text-[var(--gw-text-xs)] font-semibold"
				style="background-color: var(--gw-prio-{issue.priority === 0 || issue.priority === 1 ? issue.priority : 2}-bg);
					color: var(--gw-prio-{issue.priority === 0 || issue.priority === 1 ? issue.priority : 2}-fg)"
			>P{issue.priority}</span>
			{#if issue.phase}<Badge variant="surface">{issue.phase}</Badge>{/if}
		</div>
		<h1 class="text-[var(--gw-text-3xl)] font-bold leading-[var(--gw-leading-tight)] tracking-tight text-[var(--gw-color-text)]">
			{issue.title}
		</h1>
		<dl class="flex flex-wrap gap-x-[var(--gw-space-5)] gap-y-[var(--gw-space-1)] text-[var(--gw-text-sm)]">
			{#snippet meta(label: string, value: string)}
				<div class="flex items-center gap-[var(--gw-space-1)]">
					<dt class="text-[var(--gw-color-text-muted)]">{label}</dt>
					<dd class="text-[var(--gw-color-text)]">{value}</dd>
				</div>
			{/snippet}
			{@render meta('type', issue.issue_type)}
			{#if issue.external_ref}{@render meta('epic', issue.external_ref)}{/if}
			{@render meta('assignee', issue.assignee ?? '—')}
			{@render meta('owner', issue.owner || '—')}
			{@render meta('version', `v${issue.version}`)}
		</dl>
		{#if domains.length}
			<div class="flex flex-wrap gap-[var(--gw-space-1)]">
				{#each domains as d (d)}<Badge variant="surface">{d}</Badge>{/each}
			</div>
		{/if}
		{#if issue.operated_by}
			<OperatorBadge operator={issue.operated_by} />
		{/if}
	</header>

	{#if canWrite}
		<section
			class="space-y-[var(--gw-space-3)] rounded-[var(--gw-radius-lg)]
				border border-[var(--gw-color-border-subtle)] bg-[var(--gw-color-surface-2)]
				p-[var(--gw-space-4)]"
			aria-busy={busy}
		>
			<h2 class="text-[var(--gw-text-xs)] font-semibold uppercase tracking-widest text-[var(--gw-color-text-muted)]">
				Acciones
			</h2>
			{#if error}<Alert variant="error">{error}</Alert>{/if}
			<div class="flex flex-wrap items-center gap-[var(--gw-space-2)]">
				{#if issue.status === 'open'}
					<Button disabled={busy} onclick={() => transition('working')}>Start (→ working)</Button>
					<Button variant="tonal" disabled={busy} onclick={claim}>Claim</Button>
				{:else if issue.status === 'working'}
					<Button variant="tonal" disabled={busy} onclick={() => transition('open')}>Stop (→ open)</Button>
				{:else}
					<Button variant="tonal" disabled={busy} onclick={() => transition('open')}>Reopen</Button>
				{/if}
				{#if busy}<Spinner size={1} label="Procesando acción" />{/if}
			</div>
			{#if issue.status !== 'closed'}
				<div class="flex items-end gap-[var(--gw-space-2)]">
					<label class="flex-1 space-y-[var(--gw-space-1)]">
						<span class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
							commit_sha (required if code surface)
						</span>
						<Input bind:value={commitSha} placeholder="7+ hex" disabled={busy} />
					</label>
					<Button disabled={busy} onclick={close}>Close</Button>
				</div>
			{/if}
		</section>
	{/if}

	{#snippet body(label: string, text: string)}
		{#if text}
			<section class="space-y-[var(--gw-space-2)]">
				<h2 class="text-[var(--gw-text-sm)] font-semibold text-[var(--gw-color-text)]">{label}</h2>
				<pre
					class="overflow-x-auto whitespace-pre-wrap rounded-[var(--gw-radius-md)]
						border border-[var(--gw-color-border-subtle)] bg-[var(--gw-color-surface-2)]
						p-[var(--gw-space-3)] text-[var(--gw-text-sm)] leading-[var(--gw-leading-normal)]
						text-[var(--gw-color-text)]">{text}</pre>
			</section>
		{/if}
	{/snippet}

	{@render body('Description', issue.description)}
	{@render body('Design', issue.design)}
	{@render body('Acceptance criteria', issue.acceptance_criteria)}
	{@render body('Notes', issue.notes)}

	{#if deps.length || surfaces.length}
		<section class="grid grid-cols-1 gap-[var(--gw-space-4)] sm:grid-cols-2">
			{#if deps.length}
				<div class="space-y-[var(--gw-space-2)]">
					<h2 class="text-[var(--gw-text-sm)] font-semibold text-[var(--gw-color-text)]">Depends on</h2>
					<ul class="space-y-[var(--gw-space-1)]">
						{#each deps as d (d)}
							<li>
								<a
									class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-sm)]
										text-[var(--gw-color-primary)] no-underline hover:underline"
									href={`/tracker/${d}`}
								>{d}</a>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
			{#if surfaces.length}
				<div class="space-y-[var(--gw-space-2)]">
					<h2 class="text-[var(--gw-text-sm)] font-semibold text-[var(--gw-color-text)]">Surface</h2>
					<ul class="space-y-[var(--gw-space-1)] font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
						{#each surfaces as s (s)}<li>{s}</li>{/each}
					</ul>
				</div>
			{/if}
		</section>
	{/if}
</div>
