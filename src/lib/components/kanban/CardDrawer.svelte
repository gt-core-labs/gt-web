<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { browserComments, type BoardCard, type Comment } from '$lib/api/board';
	import {
		browserTracker,
		ISSUE_TYPES,
		parseJsonArray,
		TrackerError,
		type IssueDetail,
		type IssueRow,
		type UpdateIssueBody
	} from '$lib/api/tracker';
	import AssigneeSelect from '$lib/components/tracker/AssigneeSelect.svelte';
	import DependsOnEditor from '$lib/components/tracker/DependsOnEditor.svelte';
	import { Markdown, Spinner } from '$lib/components/ui';
	import { Icon } from '$lib/ui';

	interface Props {
		card: BoardCard;
		onClose: () => void;
		/** Session can edit (`issues.write`); read-only chips otherwise. */
		canWrite?: boolean;
		/** Registered user emails for the assignee dropdown ([] ⇒ free text). */
		users?: string[];
		/** The board's rows — depends_on candidates + type categories. */
		allIssues?: IssueRow[];
		/** Re-target the drawer to another card (gtweb-b4f9f3): parent-epic chip
		 * and epic children list navigate through this — the host page owns the
		 * `selected` card, so the drawer asks it to swap. */
		onNavigate?: (card: IssueRow) => void;
		/** Current session principal (`data.user.sub`). Gates comment edit/delete
		 * (gtweb-dd5355) to the comment's author, mirroring the backend `check_author`
		 * which also lets `admin` moderate any comment. */
		me?: string;
	}
	let { card, onClose, canWrite = false, users = [], allIssues = [], onNavigate, me = '' }: Props = $props();

	let detail = $state<IssueDetail | null>(null);
	let thread = $state<Comment[]>([]);
	let newComment = $state('');
	let replyTo = $state<string | null>(null);
	let busy = $state(false);
	let error = $state('');
	let copied = $state(false);
	// Epic linkage (child_of): the read API doesn't inline it, so the resolved
	// `parent_id` rides in on the board/table row (`card`), not the fetched detail.
	let parentRef = $state(card.parent_id ?? '');

	// Inline text-field editing (gtweb-f5b7ae): title / description / acceptance
	// criteria. The chips above cover metadata; these three free-text columns were
	// read-only. Same patch() PATCH underneath — only one field edits at a time.
	type TextField = 'title' | 'description' | 'acceptance_criteria';
	let editing = $state<TextField | null>(null);
	let draft = $state('');

	function startEdit(field: TextField) {
		if (!detail) return;
		draft = (detail[field] ?? '') as string;
		editing = field;
	}
	function cancelEdit() {
		editing = null;
		draft = '';
	}
	async function saveEdit() {
		if (!editing || !detail) return;
		const field = editing;
		if (field === 'title' && !draft.trim()) return; // title is NOT NULL
		if (draft !== ((detail[field] ?? '') as string)) {
			await patch({ [field]: draft } as UpdateIssueBody);
		}
		if (!error) cancelEdit();
	}

	async function copyId() {
		await navigator.clipboard.writeText(card.id);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}

	// (Re)load detail + thread whenever the drawer targets another card.
	$effect(() => {
		const id = card.id;
		detail = null;
		thread = [];
		error = '';
		editing = null;
		editingComment = null;
		parentRef = card.parent_id ?? '';
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

	// Comment edit/delete (gtweb-dd5355). A comment is mine to moderate when I
	// authored it or I'm the `admin` actor — same rule the backend enforces.
	const canModerate = (c: Comment) => !!me && (c.author === me || me === 'admin');
	let editingComment = $state<string | null>(null);
	let commentDraft = $state('');

	function startCommentEdit(c: Comment) {
		editingComment = c.id;
		commentDraft = c.body;
	}
	function cancelCommentEdit() {
		editingComment = null;
		commentDraft = '';
	}
	async function saveCommentEdit(id: string) {
		const body = commentDraft.trim();
		if (!body || busy) return;
		busy = true;
		error = '';
		try {
			const updated = await browserComments().update(id, body);
			thread = thread.map((c) => (c.id === id ? updated : c));
			cancelCommentEdit();
		} catch (e) {
			error = e instanceof TrackerError ? e.message : String(e);
		} finally {
			busy = false;
		}
	}
	async function deleteComment(id: string) {
		if (busy || !confirm('Delete this comment?')) return;
		busy = true;
		error = '';
		try {
			await browserComments().remove(id);
			// Drop the comment and, if it was a root, its replies — the backend
			// soft-deletes them out of the next list anyway.
			thread = thread.filter((c) => c.id !== id && c.parent_id !== id);
			if (editingComment === id) cancelCommentEdit();
		} catch (e) {
			error = e instanceof TrackerError ? e.message : String(e);
		} finally {
			busy = false;
		}
	}

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

	// Epic picker options: the scope's epics (minus this card itself).
	const epicOptions = $derived(allIssues.filter((r) => r.issue_type === 'epic' && r.id !== card.id));
	const epicTitle = (id: string) => allIssues.find((r) => r.id === id)?.title ?? id;

	// Parent↔children navigation (gtweb-b4f9f3), off the SSR-resolved parent_id.
	const parentCard = $derived(
		card.parent_id ? (allIssues.find((r) => r.id === card.parent_id) ?? null) : null
	);
	const children = $derived(
		card.issue_type === 'epic' ? allIssues.filter((r) => r.parent_id === card.id) : []
	);
	const CHILD_STATUS: Record<string, string> = {
		open: 'bg-[var(--gw-color-surface-2)] text-[var(--gw-color-text-muted)]',
		working: 'bg-amber-500/15 text-amber-500',
		closed: 'bg-emerald-500/15 text-emerald-500'
	};

	const dependsOn = $derived(detail ? parseJsonArray(detail.depends_on_json) : []);
	const depOptions = $derived(
		allIssues.filter((r) => r.id !== card.id).map((r) => ({ id: r.id, title: r.title }))
	);
	// Closed set (hq-48ca5c) + the row's own legacy value so the select never
	// renders blank on a pre-enum row.
	const typeOptions = $derived(
		detail && !(ISSUE_TYPES as readonly string[]).includes(detail.issue_type)
			? [detail.issue_type, ...ISSUE_TYPES]
			: [...ISSUE_TYPES]
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
			<p class="flex items-center gap-1.5 font-mono text-xs text-[var(--gw-color-text-muted)]">
				{card.id}
				<button
					class="rounded p-0.5 hover:bg-[var(--gw-color-surface-2)] hover:text-[var(--gw-color-text)]"
					title="Copy id"
					aria-label="Copy bead id"
					onclick={copyId}
				>
					<Icon icon={copied ? 'lucide:check' : 'lucide:copy'} size={12} />
				</button>
				{#if copied}<span class="text-[10px] text-emerald-500">copied</span>{/if}
			</p>
			{#if editing === 'title'}
				<div class="flex items-center gap-1">
					<!-- svelte-ignore a11y_autofocus -->
					<input
						class="{editCls} w-full text-base"
						value={draft}
						aria-label="Edit title"
						autofocus
						oninput={(e) => (draft = (e.currentTarget as HTMLInputElement).value)}
						onkeydown={(e) => {
							if (e.key === 'Enter') saveEdit();
							else if (e.key === 'Escape') cancelEdit();
						}}
					/>
					<button class="rounded p-1 text-emerald-500 hover:bg-[var(--gw-color-surface-2)]" title="Save" aria-label="Save title" onclick={saveEdit}>
						<Icon icon="lucide:check" size={14} />
					</button>
					<button class="rounded p-1 text-[var(--gw-color-text-muted)] hover:bg-[var(--gw-color-surface-2)]" title="Cancel" aria-label="Cancel title edit" onclick={cancelEdit}>
						<Icon icon="lucide:x" size={14} />
					</button>
				</div>
			{:else}
				<div class="flex items-center gap-1">
					<h2 class="truncate text-base font-semibold">{detail?.title ?? card.title}</h2>
					{#if canWrite}
						<button
							class="shrink-0 rounded p-0.5 text-[var(--gw-color-text-muted)] hover:bg-[var(--gw-color-surface-2)] hover:text-[var(--gw-color-text)]"
							title="Edit title"
							aria-label="Edit title"
							onclick={() => startEdit('title')}
						><Icon icon="lucide:pencil" size={12} /></button>
					{/if}
				</div>
			{/if}
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
				<select
					class={editCls}
					value={detail.issue_type}
					aria-label="Type"
					onchange={(e) => {
						const v = (e.currentTarget as HTMLSelectElement).value;
						if (v !== detail!.issue_type) patch({ issue_type: v });
					}}
				>
					{#each typeOptions as t (t)}<option value={t}>{t}</option>{/each}
				</select>
				<AssigneeSelect
					class="{editCls} max-w-36"
					value={detail.assignee ?? ''}
					{users}
					onchange={(v) => patch({ assignee: v })}
				/>
				{#if detail.issue_type !== 'epic'}
					<select
						class="{editCls} max-w-44"
						value={parentRef}
						aria-label="Epic"
						onchange={(e) => {
							const v = (e.currentTarget as HTMLSelectElement).value;
							parentRef = v;
							patch({ parent_id: v });
						}}
					>
						<option value="">— no epic —</option>
						{#each epicOptions as ep (ep.id)}<option value={ep.id}>{ep.title}</option>{/each}
					</select>
					{#if parentCard && onNavigate}
						<button
							class="rounded p-1 text-[var(--gw-color-text-muted)] hover:bg-[var(--gw-color-surface-2)] hover:text-[var(--gw-color-text)]"
							title="Open epic {parentCard.id}"
							aria-label="Open parent epic {parentCard.id}"
							onclick={() => onNavigate?.(parentCard)}
						><Icon icon="lucide:arrow-up-right" size={14} /></button>
					{/if}
				{/if}
				{#if card.estimated_hours != null}<span class={chipCls}>{card.estimated_hours}h</span>{/if}
				{#if card.due_date}<span class={chipCls}>due {card.due_date}</span>{/if}
			</div>
		{:else}
			<div class="flex flex-wrap gap-2 text-xs">
				<span class={chipCls}>{card.status}</span>
				<span class={chipCls}>{PRIORITY[card.priority] ?? `P${card.priority}`}</span>
				<span class={chipCls}>{card.issue_type}</span>
				{#if card.assignee}<span class={chipCls}>@{card.assignee}</span>{/if}
				{#if card.parent_id}
					{#if parentCard && onNavigate}
						<button
							class="{chipCls} text-[var(--gw-color-primary)] hover:underline"
							title="Open epic {card.parent_id}"
							onclick={() => onNavigate?.(parentCard)}
						>epic {epicTitle(card.parent_id)}</button>
					{:else}
						<span class={chipCls}>epic {epicTitle(card.parent_id)}</span>
					{/if}
				{/if}
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
			<!-- Free-text columns (gtweb-f5b7ae): read-only Markdown, or a textarea
			     when the operator (issues.write) clicks ✎. Shown even when empty so an
			     editor can fill them in. -->
			{#snippet textSection(label: string, field: 'description' | 'acceptance_criteria', value: string)}
				{#if value || canWrite}
					<section>
						<div class="mb-1 flex items-center justify-between gap-2">
							<h3 class="text-xs font-semibold uppercase text-[var(--gw-color-text-muted)]">{label}</h3>
							{#if canWrite && editing !== field}
								<button
									class="rounded p-0.5 text-[var(--gw-color-text-muted)] hover:bg-[var(--gw-color-surface-2)] hover:text-[var(--gw-color-text)]"
									title="Edit {label.toLowerCase()}"
									aria-label="Edit {label.toLowerCase()}"
									onclick={() => startEdit(field)}
								><Icon icon="lucide:pencil" size={12} /></button>
							{/if}
						</div>
						{#if editing === field}
							<textarea
								class="{editCls} min-h-32 w-full font-mono leading-relaxed"
								value={draft}
								aria-label="Edit {label.toLowerCase()}"
								oninput={(e) => (draft = (e.currentTarget as HTMLTextAreaElement).value)}
								onkeydown={(e) => e.key === 'Escape' && cancelEdit()}
							></textarea>
							<div class="mt-1.5 flex gap-2">
								<button class="rounded bg-[var(--gw-color-primary)] px-2.5 py-1 text-xs text-white hover:opacity-90" onclick={saveEdit}>Save</button>
								<button class="rounded border border-[var(--gw-color-border)] px-2.5 py-1 text-xs text-[var(--gw-color-text-muted)] hover:bg-[var(--gw-color-surface-2)]" onclick={cancelEdit}>Cancel</button>
							</div>
						{:else if value}
							<Markdown text={value} />
						{:else}
							<p class="text-sm italic text-[var(--gw-color-text-muted)]">Empty — click ✎ to add.</p>
						{/if}
					</section>
				{/if}
			{/snippet}

			{@render textSection('Description', 'description', detail.description)}
			{@render textSection('Acceptance criteria', 'acceptance_criteria', detail.acceptance_criteria)}

			{#if card.issue_type === 'epic'}
				<section>
					<h3 class="mb-1 text-xs font-semibold uppercase text-[var(--gw-color-text-muted)]">
						Children ({children.length})
					</h3>
					{#if children.length}
						<ul class="divide-y divide-[var(--gw-color-border)] rounded-lg border border-[var(--gw-color-border)]">
							{#each children as child (child.id)}
								<li>
									<button
										class="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-[var(--gw-color-surface-2)] disabled:cursor-default"
										disabled={!onNavigate}
										onclick={() => onNavigate?.(child)}
									>
										<span class="shrink-0 rounded px-1.5 py-0.5 text-[11px] {CHILD_STATUS[child.status] ?? ''}">{child.status}</span>
										<span class="shrink-0 font-mono text-[11px] text-[var(--gw-color-text-muted)]">{child.id}</span>
										<span class="min-w-0 truncate">{child.title}</span>
									</button>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="text-sm text-[var(--gw-color-text-muted)]">No children yet — assign beads to this epic to see them here.</p>
					{/if}
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
				{#snippet commentBody(c: Comment)}
					{#if editingComment === c.id}
						<textarea
							class="{editCls} mt-1 min-h-20 w-full"
							value={commentDraft}
							aria-label="Edit comment"
							oninput={(e) => (commentDraft = (e.currentTarget as HTMLTextAreaElement).value)}
							onkeydown={(e) => e.key === 'Escape' && cancelCommentEdit()}
						></textarea>
						<div class="mt-1 flex gap-2">
							<button class="rounded bg-[var(--gw-color-primary)] px-2.5 py-1 text-xs text-white disabled:opacity-50" disabled={busy || !commentDraft.trim()} onclick={() => saveCommentEdit(c.id)}>Save</button>
							<button class="rounded border border-[var(--gw-color-border)] px-2.5 py-1 text-xs text-[var(--gw-color-text-muted)]" onclick={cancelCommentEdit}>Cancel</button>
						</div>
					{:else}
						<p class="whitespace-pre-wrap text-sm">{c.body}</p>
					{/if}
				{/snippet}

				{#snippet commentActions(c: Comment, withReply: boolean)}
					{#if editingComment !== c.id}
						<div class="mt-1 flex gap-3 text-xs">
							{#if withReply}
								<button
									class="text-[var(--gw-color-primary)] hover:underline"
									onclick={() => (replyTo = replyTo === c.id ? null : c.id)}
								>{replyTo === c.id ? 'Cancel' : 'Reply'}</button>
							{/if}
							{#if canModerate(c)}
								<button class="text-[var(--gw-color-text-muted)] hover:text-[var(--gw-color-text)] hover:underline" onclick={() => startCommentEdit(c)}>Edit</button>
								<button class="text-[var(--gw-color-danger)] hover:underline disabled:opacity-50" disabled={busy} onclick={() => deleteComment(c.id)}>Delete</button>
							{/if}
						</div>
					{/if}
				{/snippet}

				{#each roots as c (c.id)}
					<li>
						<div class="rounded-lg bg-[var(--gw-color-surface-2)] p-2">
							<p class="text-xs text-[var(--gw-color-text-muted)]">
								<span class="font-medium">{c.author}</span>
								· {new Date(c.created_at).toLocaleString()}
								{#if c.edited_at}· edited{/if}
							</p>
							{@render commentBody(c)}
							{@render commentActions(c, true)}
						</div>
						{#each repliesOf(c.id) as r (r.id)}
							<div class="mt-1 ml-5 rounded-lg bg-[var(--gw-color-surface-2)] p-2">
								<p class="text-xs text-[var(--gw-color-text-muted)]">
									<span class="font-medium">{r.author}</span>
									· {new Date(r.created_at).toLocaleString()}
									{#if r.edited_at}· edited{/if}
								</p>
								{@render commentBody(r)}
								{@render commentActions(r, false)}
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
