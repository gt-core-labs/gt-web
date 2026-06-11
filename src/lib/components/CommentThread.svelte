<script lang="ts">
	/**
	 * Generic threaded comment surface (hq-57042e) for a card or doc target —
	 * the doc-editor sibling of the Kanban drawer's thread. `@handle` in a body
	 * notifies the named workspace member.
	 */
	import { browserComments, type Comment } from '$lib/api/board';
	import { TrackerError } from '$lib/api/tracker';

	interface Props {
		targetKind: 'card' | 'doc';
		targetId: string;
	}
	let { targetKind, targetId }: Props = $props();

	let thread = $state<Comment[]>([]);
	let newComment = $state('');
	let replyTo = $state<string | null>(null);
	let busy = $state(false);
	let error = $state('');

	$effect(() => {
		const id = targetId;
		thread = [];
		browserComments()
			.list(targetKind, id)
			.then((c) => {
				if (targetId === id) thread = c;
			})
			.catch((e) => (error = e instanceof TrackerError ? e.message : String(e)));
	});

	const roots = $derived(thread.filter((c) => !c.parent_id));
	const repliesOf = (id: string) => thread.filter((c) => c.parent_id === id);

	async function send() {
		const body = newComment.trim();
		if (!body || busy) return;
		busy = true;
		error = '';
		try {
			const created = await browserComments().create({
				target_kind: targetKind,
				target_id: targetId,
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
</script>

<section class="space-y-2">
	<h2 class="text-sm font-semibold">Comentarios ({thread.length})</h2>
	{#if error}<p class="text-sm text-[var(--gw-color-error)]">{error}</p>{/if}

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

	{#if replyTo}<p class="text-xs text-[var(--gw-color-text-muted)]">Respondiendo a {replyTo}</p>{/if}
	<form
		class="flex gap-2"
		onsubmit={(e) => {
			e.preventDefault();
			send();
		}}
	>
		<input
			class="input min-w-0 flex-1"
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
</section>
