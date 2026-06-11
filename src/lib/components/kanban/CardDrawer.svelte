<script lang="ts">
	import { browserComments, type BoardCard, type Comment } from '$lib/api/board';
	import { browserTracker, TrackerError, type IssueDetail } from '$lib/api/tracker';
	import { Markdown, Spinner } from '$lib/components/ui';

	interface Props {
		card: BoardCard;
		onClose: () => void;
	}
	let { card, onClose }: Props = $props();

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

	const PRIORITY = ['P0', 'P1', 'P2'];
</script>

<!-- Right-side drawer: card detail + threaded comments (hq-95c2bb). -->
<aside
	class="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-[var(--gw-color-border)] bg-[var(--gw-color-surface)] shadow-2xl"
	aria-label="Card detail"
>
	<header class="flex items-start justify-between gap-3 border-b border-[var(--gw-color-border)] p-4">
		<div class="min-w-0">
			<p class="font-mono text-xs text-[var(--gw-color-text-muted)]">{card.id}</p>
			<h2 class="truncate text-base font-semibold">{card.title}</h2>
		</div>
		<button
			class="rounded p-1 text-[var(--gw-color-text-muted)] hover:bg-[var(--gw-color-surface-2)]"
			onclick={onClose}
			aria-label="Close drawer"
		>✕</button>
	</header>

	<div class="flex-1 space-y-4 overflow-y-auto p-4">
		<div class="flex flex-wrap gap-2 text-xs">
			<span class="rounded bg-[var(--gw-color-surface-2)] px-2 py-1">{card.status}</span>
			<span class="rounded bg-[var(--gw-color-surface-2)] px-2 py-1">{PRIORITY[card.priority] ?? `P${card.priority}`}</span>
			<span class="rounded bg-[var(--gw-color-surface-2)] px-2 py-1">{card.issue_type}</span>
			{#if card.assignee}<span class="rounded bg-[var(--gw-color-surface-2)] px-2 py-1">@{card.assignee}</span>{/if}
			{#if card.external_ref}<span class="rounded bg-[var(--gw-color-surface-2)] px-2 py-1">epic {card.external_ref}</span>{/if}
			{#if card.estimated_hours != null}<span class="rounded bg-[var(--gw-color-surface-2)] px-2 py-1">{card.estimated_hours}h</span>{/if}
			{#if card.due_date}<span class="rounded bg-[var(--gw-color-surface-2)] px-2 py-1">fin {card.due_date}</span>{/if}
		</div>

		{#if error}
			<p class="text-sm text-[var(--gw-color-danger)]">{error}</p>
		{/if}

		{#if !detail}
			<Spinner />
		{:else}
			{#if detail.description}
				<section>
					<h3 class="mb-1 text-xs font-semibold uppercase text-[var(--gw-color-text-muted)]">Descripción</h3>
					<Markdown text={detail.description} />
				</section>
			{/if}
			{#if detail.acceptance_criteria}
				<section>
					<h3 class="mb-1 text-xs font-semibold uppercase text-[var(--gw-color-text-muted)]">Criterios de aceptación</h3>
					<Markdown text={detail.acceptance_criteria} />
				</section>
			{/if}
		{/if}

		<section>
			<h3 class="mb-2 text-xs font-semibold uppercase text-[var(--gw-color-text-muted)]">
				Comentarios ({thread.length})
			</h3>
			<ul class="space-y-3">
				{#each roots as c (c.id)}
					<li>
						<div class="rounded-lg bg-[var(--gw-color-surface-2)] p-2">
							<p class="text-xs text-[var(--gw-color-text-muted)]">
								<span class="font-medium">{c.author}</span>
								· {new Date(c.created_at).toLocaleString()}
								{#if c.edited_at}· editado{/if}
							</p>
							<p class="whitespace-pre-wrap text-sm">{c.body}</p>
							<button
								class="mt-1 text-xs text-[var(--gw-color-primary)] hover:underline"
								onclick={() => (replyTo = replyTo === c.id ? null : c.id)}
							>{replyTo === c.id ? 'Cancelar' : 'Responder'}</button>
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
					<li class="text-sm text-[var(--gw-color-text-muted)]">Sin comentarios. @menciona a un miembro para notificarle.</li>
				{/each}
			</ul>
		</section>
	</div>

	<footer class="border-t border-[var(--gw-color-border)] p-3">
		{#if replyTo}
			<p class="mb-1 text-xs text-[var(--gw-color-text-muted)]">Respondiendo a {replyTo}</p>
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
				placeholder="Comentar… (@usuario notifica)"
				bind:value={newComment}
				disabled={busy}
			/>
			<button
				class="rounded bg-[var(--gw-color-primary)] px-3 py-1.5 text-sm text-white disabled:opacity-50"
				disabled={busy || !newComment.trim()}
				type="submit"
			>Enviar</button>
		</form>
	</footer>
</aside>
