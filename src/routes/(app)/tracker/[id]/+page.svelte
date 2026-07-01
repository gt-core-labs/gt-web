<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { base } from '$app/paths';
	import { browserTracker, parseJsonArray, TrackerError, type IssueStatus } from '$lib/api/tracker';
	import { hasScope } from '$lib/api/auth';
	import { Input } from '$lib/ui';
	import { Markdown, Spinner } from '$lib/components/ui';
	import CommentThread from '$lib/components/CommentThread.svelte';
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

	const prioVar = (p: number) => (p === 0 || p === 1 ? p : 2);

	const statusAccent: Record<string, string> = {
		open: 'var(--gw-color-primary)',
		working: 'var(--gw-color-warning)',
		closed: 'var(--gw-color-success)'
	};

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

<div class="mx-auto max-w-3xl xl:max-w-4xl 2xl:max-w-5xl flex flex-col gap-8">

	<!-- ── Back link ──────────────────────────────────────────────────────────── -->
	<a
		href="{base}/tracker"
		class="group inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--gw-color-border)] px-3 py-1.5
			text-xs text-[var(--gw-color-text-muted)] no-underline
			transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
			hover:border-[var(--gw-color-text-muted)] hover:text-[var(--gw-color-text)]
			focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gw-color-primary-focus)]"
	>
		<span aria-hidden="true" class="transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-x-0.5">←</span>
		Tracker
	</a>

	<!-- ── Identity header ────────────────────────────────────────────────────── -->
	<header class="flex flex-col gap-4">
		<!-- Meta chips row -->
		<div class="flex flex-wrap items-center gap-2">
			<code class="rounded-md bg-[var(--gw-color-surface-3)] px-2 py-0.5 font-mono text-xs text-[var(--gw-color-text-muted)]">
				{issue.id}
			</code>
			<!-- Status chip -->
			<span
				class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
				style="background-color: color-mix(in oklch, {statusAccent[issue.status] ?? 'var(--gw-color-border)'} 12%, transparent); color: {statusAccent[issue.status] ?? 'var(--gw-color-text-muted)'}"
			>
				<span aria-hidden="true" class="h-1.5 w-1.5 rounded-full" style="background: {statusAccent[issue.status] ?? 'var(--gw-color-border)'}"></span>
				{issue.status}
			</span>
			<!-- Priority badge -->
			<span
				class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
				style="background-color: var(--gw-prio-{prioVar(issue.priority)}-bg); color: var(--gw-prio-{prioVar(issue.priority)}-fg)"
			>P{issue.priority}</span>
			{#if issue.phase}
				<span class="rounded-full border border-[var(--gw-color-border)] px-2.5 py-0.5 text-[11px] text-[var(--gw-color-text-muted)]">
					{issue.phase}
				</span>
			{/if}
		</div>

		<!-- Title -->
		<h1 class="text-3xl font-bold leading-tight tracking-tight text-[var(--gw-color-text)] xl:text-4xl">
			{issue.title}
		</h1>

		<!-- Meta dl -->
		<dl class="flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
			{#snippet meta(label: string, value: string)}
				<div class="flex items-center gap-1.5">
					<dt class="text-xs text-[var(--gw-color-text-muted)]">{label}</dt>
					<dd class="text-sm text-[var(--gw-color-text)]">{value}</dd>
				</div>
			{/snippet}
			{@render meta('type', issue.issue_type)}
			{#if issue.external_ref}{@render meta('epic', issue.external_ref)}{/if}
			{@render meta('assignee', issue.assignee ?? '—')}
			{@render meta('owner', issue.owner || '—')}
			{@render meta('v', `${issue.version}`)}
		</dl>

		<!-- Domain chips -->
		{#if domains.length}
			<div class="flex flex-wrap gap-1.5">
				{#each domains as d (d)}
					<span class="rounded-full border border-[var(--gw-color-border)] bg-[var(--gw-color-surface-3)] px-2.5 py-0.5 font-mono text-[10px] text-[var(--gw-color-text-muted)]">
						{d}
					</span>
				{/each}
			</div>
		{/if}

		{#if issue.operated_by}
			<OperatorBadge operator={issue.operated_by} />
		{/if}
	</header>

	<!-- ── Actions (Double-Bezel) ─────────────────────────────────────────────── -->
	{#if canWrite}
		<section aria-busy={busy}>
			<!-- Outer shell -->
			<div class="rounded-[1.5rem] border border-[var(--gw-color-border)] bg-[var(--gw-color-border)]/20 p-[3px]">
				<!-- Inner core -->
				<div class="rounded-[calc(1.5rem-3px)] bg-[var(--gw-color-surface)] px-5 py-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] sm:px-6">

					<p class="mb-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--gw-color-text-muted)]">
						Actions
					</p>

					{#if error}
						<div class="mb-4 rounded-2xl border border-[var(--color-error-500)]/30 bg-[var(--color-error-500)]/8 px-4 py-2.5 text-sm text-[var(--color-error-500)]">
							{error}
						</div>
					{/if}

					<div class="flex flex-wrap items-center gap-2">
						{#if issue.status === 'open'}
							<button
								disabled={busy}
								onclick={() => transition('working')}
								class="action-btn action-btn-primary"
							>
								Start <span class="opacity-60">→ working</span>
							</button>
							<button disabled={busy} onclick={claim} class="action-btn">Claim</button>
						{:else if issue.status === 'working'}
							<button
								disabled={busy}
								onclick={() => transition('open')}
								class="action-btn"
							>
								Stop <span class="opacity-60">→ open</span>
							</button>
						{:else}
							<button disabled={busy} onclick={() => transition('open')} class="action-btn">
								Reopen
							</button>
						{/if}
						{#if busy}<Spinner size={1} label="Procesando acción" />{/if}
					</div>

					{#if issue.status !== 'closed'}
						<div class="mt-4 flex items-end gap-2">
							<label class="flex flex-1 flex-col gap-1.5">
								<span class="text-[10px] uppercase tracking-[0.12em] font-medium text-[var(--gw-color-text-muted)]">
									commit_sha <span class="normal-case tracking-normal opacity-60">required if code surface</span>
								</span>
								<div class="field-wrap">
									<input class="field-input font-mono" bind:value={commitSha} placeholder="7+ hex" disabled={busy} />
								</div>
							</label>
							<button
								disabled={busy}
								onclick={close}
								class="action-btn action-btn-primary shrink-0"
							>
								Close
							</button>
						</div>
					{/if}

				</div>
			</div>
		</section>
	{/if}

	<!-- ── Content sections ───────────────────────────────────────────────────── -->
	{#snippet body(label: string, text: string)}
		{#if text}
			<section class="flex flex-col gap-3">
				<h2 class="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--gw-color-text-muted)]">{label}</h2>
				<div
					class="overflow-x-auto rounded-2xl
						border border-[var(--gw-color-border)] bg-[var(--gw-color-surface-2)]
						px-5 py-4 text-sm leading-relaxed text-[var(--gw-color-text)]"
				>
					<Markdown {text} />
				</div>
			</section>
		{/if}
	{/snippet}

	{@render body('Description', issue.description)}
	{@render body('Design', issue.design)}
	{@render body('Acceptance criteria', issue.acceptance_criteria)}
	{@render body('Notes', issue.notes)}

	<!-- ── Comments ──────────────────────────────────────────────────────────── -->
	<section class="flex flex-col gap-3">
		<h2 class="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--gw-color-text-muted)]">Comentarios</h2>
		<div class="rounded-2xl border border-[var(--gw-color-border)] bg-[var(--gw-color-surface-2)] px-5 py-4">
			<CommentThread targetKind="card" targetId={issue.id} />
		</div>
	</section>

	<!-- ── Deps + surfaces ────────────────────────────────────────────────────── -->
	{#if deps.length || surfaces.length}
		<section class="grid grid-cols-1 gap-5 sm:grid-cols-2">
			{#if deps.length}
				<div class="flex flex-col gap-3">
					<h2 class="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--gw-color-text-muted)]">Depends on</h2>
					<ul class="flex flex-col gap-1.5">
						{#each deps as d (d)}
							<li>
								<a
									class="font-mono text-sm text-[var(--gw-color-primary)] no-underline
										transition-opacity duration-200 hover:opacity-75"
									href={`/tracker/${d}`}
								>{d}</a>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
			{#if surfaces.length}
				<div class="flex flex-col gap-3">
					<h2 class="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--gw-color-text-muted)]">Surface</h2>
					<ul class="flex flex-wrap gap-1.5">
						{#each surfaces as s (s)}
							<li class="rounded-md bg-[var(--gw-color-surface-3)] px-2 py-0.5 font-mono text-xs text-[var(--gw-color-text-muted)]">{s}</li>
						{/each}
					</ul>
				</div>
			{/if}
		</section>
	{/if}

</div>

<style>
	.field-wrap {
		border-radius: 0.75rem;
		border: 1px solid var(--gw-color-border);
		background: var(--gw-color-surface-2);
		transition:
			border-color 0.25s cubic-bezier(0.32, 0.72, 0, 1),
			box-shadow 0.25s cubic-bezier(0.32, 0.72, 0, 1);
	}
	.field-wrap:focus-within {
		border-color: var(--gw-color-primary);
		box-shadow: 0 0 0 3px color-mix(in oklch, var(--gw-color-primary) 20%, transparent);
	}
	.field-input {
		display: block;
		width: 100%;
		background: transparent;
		border: none;
		outline: none;
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		color: var(--gw-color-text);
		border-radius: 0.75rem;
	}
	.field-input::placeholder {
		color: color-mix(in oklch, var(--gw-color-text-muted) 50%, transparent);
	}

	.action-btn {
		border-radius: 9999px;
		border: 1px solid var(--gw-color-border);
		padding: 0.375rem 1rem;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--gw-color-text-muted);
		background: transparent;
		cursor: pointer;
		transition: all 0.25s cubic-bezier(0.32, 0.72, 0, 1);
	}
	.action-btn:hover {
		border-color: var(--gw-color-text-muted);
		color: var(--gw-color-text);
	}
	.action-btn:active { transform: scale(0.97); }
	.action-btn:disabled { cursor: not-allowed; opacity: 0.4; }
	.action-btn:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--gw-color-primary-focus);
	}

	.action-btn-primary {
		background: var(--gw-color-primary);
		border-color: var(--gw-color-primary);
		color: white;
	}
	.action-btn-primary:hover {
		opacity: 0.9;
		color: white;
		border-color: var(--gw-color-primary);
	}
</style>
