<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { browserComments, type BoardCard, type Comment } from '$lib/api/board';
	import {
		browserTracker,
		parseJsonArray,
		TrackerError,
		type IssueDetail,
		type IssueRow,
		type UpdateIssueBody
	} from '$lib/api/tracker';
	import AssigneeSelect from '$lib/components/tracker/AssigneeSelect.svelte';
	import DependsOnEditor from '$lib/components/tracker/DependsOnEditor.svelte';
	import { Markdown, Spinner } from '$lib/components/ui';

	interface Props {
		card: BoardCard;
		onClose: () => void;
		/** Session can edit (`issues.write`); read-only chips otherwise. */
		canWrite?: boolean;
		/** Registered user emails for the assignee dropdown ([] ⇒ free text). */
		users?: string[];
		/** The board's rows — depends_on candidates + type categories. */
		allIssues?: IssueRow[];
	}
	let { card, onClose, canWrite = false, users = [], allIssues = [] }: Props = $props();

	let detail = $state<IssueDetail | null>(null);
	let thread = $state<Comment[]>([]);
	let newComment = $state('');
	let replyTo = $state<string | null>(null);
	let busy = $state(false);
	let error = $state('');

	// (Re)load detail + thread whenever the drawer targets another card.
	$effect(() => {
		const id = card.id;
		detail = null;
		thread = [];
		error = '';
		Promise.all([browserTracker().get(id), browserComments().list('card', id)])
			.then(([d, c]) => {
				if (card.id !== id) return; // drawer moved on
				detail = d;
				thread = c;
			})
			.catch((e) => (error = e instanceof TrackerError ? e.message : String(e)));
	});

	/** Top-level comments first; replies indent under their parent. */
	const roots = $derived(thread.filter((c) => !c.parent_id));
	const repliesOf = (id: string) => thread.filter((c) => c.parent_id === id);

	async function send() {
		const body = newComment.trim();
		if (!body || busy) return;
		busy = true;
		error = '';
		try {
			const created = await browserComments().create({
				target_kind: 'card',
				target_id: card.id,
				body,
				...(replyTo ? { parent_id: replyTo } : {})
			});
			thread = [...thread, created];
			newComment = '';
			replyTo = null;
		} catch (e) {
			error = e instanceof TrackerError ? e.message : String(e);
		} finally {
			busy = false;
		}
	}

	// ── inline field edits (hq-039316): PATCH + refresh the local detail ────
	async function patch(body: UpdateIssueBody) {
		if (!detail) return;
		error = '';
		try {
			await browserTracker().update(detail.id, body);
			detail = { ...detail, ...(body as Partial<IssueDetail>) };
			if (body.depends_on) detail.depends_on_json = JSON.stringify(body.depends_on);
			await invalidateAll(); // the page behind re-reads the board/table
		} catch (e) {
			error = e instanceof TrackerError ? e.message : String(e);
		}
	}

	const dependsOn = $derived(detail ? parseJsonArray(detail.depends_on_json) : []);
	const depOptions = $derived(
		allIssues.filter((r) => r.id !== card.id).map((r) => ({ id: r.id, title: r.title }))
	);
	const typeOptions = $derived(
		[...new Set(allIssues.map((r) => r.issue_type).filter(Boolean))].sort()
	);

	const PRIORITY = ['P0', 'P1', 'P2'];
	const chipCls = 'rounded bg-[var(--gw-color-surface-2)] px-2 py-1';
	const editCls =
		'rounded border border-[var(--gw-color-border)] bg-[var(--gw-color-surface-2)] px-1.5 py-1 text-xs focus:border-[var(--gw-color-primary)] focus:outline-none';
</script>

<!-- Modal: card detail + threaded comments (hq-95c2bb). -->
<svelte:window onkeydown={(e) => e.key === 'Escape' && onClose()} />

<!-- Backdrop — fixed, so backdrop-blur is safe here (no scrolling container). -->
<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl"
	style="background: rgba(0,0,0,0.55)"
	role="presentation"
	onclick={onClose}
>
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
	<div
		class="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-[1.25rem] border border-[var(--gw-color-border)] bg-[var(--gw-color-surface)] shadow-2xl"
		role="dialog"
		aria-modal="true"
		aria-label="Card detail"
		tabindex="-1"
		onclick={(e) => e.stopPropagation()}
	>
	<header class="flex items-start justify-between gap-3 border-b border-[var(--gw-color-border)] p-4">
		<div class="min-w-0">
			<p class="font-mono text-xs text-[var(--gw-color-text-muted)]">{card.id}</p>
			<h2 class="truncate text-base font-semibold">{card.title}</h2>
		</div>
		<div class="flex shrink-0 items-center gap-1">
			{#if canWrite}
				<!-- Manual archiving (hq-039316): re-scope to the `archive` board workspace. -->
				<button
					class="rounded border border-[var(--gw-color-border)] px-2 py-1 text-xs text-[var(--gw-color-text-muted)] hover:bg-[var(--gw-color-surface-2)]"
					onclick={async () => {
						await patch({ workspace: card.workspace === 'archive' ? 'default' : 'archive' });
						if (!error) onClose();
					}}
				>{card.workspace === 'archive' ? 'Restore' : 'Archive'}</button>
			{/if}
			<button
				class="rounded p-1 text-[var(--gw-color-text-muted)] hover:bg-[var(--gw-color-surface-2)]"
				onclick={onClose}
				aria-label="Close drawer"
			>✕</button>
		</div>
	</header>

	<div class="flex-1 space-y-4 overflow-y-auto p-4">
		{#if canWrite && detail}
			<!-- Editable chips (hq-039316): priority / type / assignee / epic ref. -->
			<div class="flex flex-wrap items-center gap-2 text-xs">
				<span class={chipCls}>{card.status}</span>
				<select
					class={editCls}
					value={String(detail.priority)}
					aria-label="Priority"
					onchange={(e) => patch({ priority: Number((e.currentTarget as HTMLSelectElement).value) })}
				>
					<option value="0">P0</option>
					<option value="1">P1</option>
					<option value="2">P2</option>
				</select>
				<input
					class="{editCls} w-20"
					list="drawer-issue-types"
					value={detail.issue_type}
					aria-label="Type"
					onchange={(e) => {
						const v = (e.currentTarget as HTMLInputElement).value.trim();
						if (v) patch({ issue_type: v });
					}}
				/>
				<datalist id="drawer-issue-types">
					{#each typeOptions as t (t)}<option value={t}></option>{/each}
				</datalist>
				<AssigneeSelect
					class="{editCls} max-w-36"
					value={detail.assignee ?? ''}
					{users}
					onchange={(v) => patch({ assignee: v })}
				/>
				<input
					class="{editCls} w-24 font-mono"
					value={detail.external_ref ?? ''}
					placeholder="epic ref"
					aria-label="Epic ref"
					onchange={(e) => patch({ external_ref: (e.currentTarget as HTMLInputElement).value.trim() })}
				/>
				{#if card.estimated_hours != null}<span class={chipCls}>{card.estimated_hours}h</span>{/if}
				{#if card.due_date}<span class={chipCls}>due {card.due_date}</span>{/if}
			</div>
		{:else}
			<div class="flex flex-wrap gap-2 text-xs">
				<span class={chipCls}>{card.status}</span>
				<span class={chipCls}>{PRIORITY[card.priority] ?? `P${card.priority}`}</span>
				<span class={chipCls}>{card.issue_type}</span>
				{#if card.assignee}<span class={chipCls}>@{card.assignee}</span>{/if}
				{#if card.external_ref}<span class={chipCls}>epic {card.external_ref}</span>{/if}
				{#if card.estimated_hours != null}<span class={chipCls}>{card.estimated_hours}h</span>{/if}
				{#if card.due_date}<span class={chipCls}>due {card.due_date}</span>{/if}
			</div>
		{/if}

		{#if error}
			<p class="text-sm text-[var(--gw-color-danger)]">{error}</p>
		{/if}

		{#if !detail}
			<Spinner />
		{:else}
			{#if detail.description}
				<section>
					<h3 class="mb-1 text-xs font-semibold uppercase text-[var(--gw-color-text-muted)]">Description</h3>
					<Markdown text={detail.description} />
				</section>
			{/if}
			{#if detail.acceptance_criteria}
				<section>
					<h3 class="mb-1 text-xs font-semibold uppercase text-[var(--gw-color-text-muted)]">Acceptance criteria</h3>
					<Markdown text={detail.acceptance_criteria} />
				</section>
			{/if}

			{#if canWrite || dependsOn.length > 0}
				<section>
					<h3 class="mb-1 text-xs font-semibold uppercase text-[var(--gw-color-text-muted)]">References</h3>
					<DependsOnEditor
						ids={dependsOn}
						options={depOptions}
						disabled={!canWrite}
						onchange={(ids) => patch({ depends_on: ids })}
					/>
				</section>
			{/if}
		{/if}

		<section>
			<h3 class="mb-2 text-xs font-semibold uppercase text-[var(--gw-color-text-muted)]">
				Comments ({thread.length})
			</h3>
			<ul class="space-y-3">
				{#each roots as c (c.id)}
					<li>
						<div class="rounded-lg bg-[var(--gw-color-surface-2)] p-2">
							<p class="text-xs text-[var(--gw-color-text-muted)]">
								<span class="font-medium">{c.author}</span>
								· {new Date(c.created_at).toLocaleString()}
								{#if c.edited_at}· edited{/if}
							</p>
							<p class="whitespace-pre-wrap text-sm">{c.body}</p>
							<button
								class="mt-1 text-xs text-[var(--gw-color-primary)] hover:underline"
								onclick={() => (replyTo = replyTo === c.id ? null : c.id)}
							>{replyTo === c.id ? 'Cancel' : 'Reply'}</button>
						</div>
						{#each repliesOf(c.id) as r (r.id)}
							<div class="mt-1 ml-5 rounded-lg bg-[var(--gw-color-surface-2)] p-2">
								<p class="text-xs text-[var(--gw-color-text-muted)]">
									<span class="font-medium">{r.author}</span>
									· {new Date(r.created_at).toLocaleString()}
								</p>
								<p class="whitespace-pre-wrap text-sm">{r.body}</p>
							</div>
						{/each}
					</li>
				{:else}
					<li class="text-sm text-[var(--gw-color-text-muted)]">No comments. @mention a member to notify them.</li>
				{/each}
			</ul>
		</section>
	</div>

	<footer class="border-t border-[var(--gw-color-border)] p-3">
		{#if replyTo}
			<p class="mb-1 text-xs text-[var(--gw-color-text-muted)]">Replying to {replyTo}</p>
		{/if}
		<form
			class="flex gap-2"
			onsubmit={(e) => {
				e.preventDefault();
				send();
			}}
		>
			<input
				class="min-w-0 flex-1 rounded border border-[var(--gw-color-border)] bg-transparent px-2 py-1.5 text-sm"
				placeholder="Comment… (@user notifies)"
				bind:value={newComment}
				disabled={busy}
			/>
			<button
				class="rounded bg-[var(--gw-color-primary)] px-3 py-1.5 text-sm text-white disabled:opacity-50"
				disabled={busy || !newComment.trim()}
				type="submit"
			>Send</button>
		</form>
	</footer>
	</div>
</div>
