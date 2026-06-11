<script lang="ts">
	/**
	 * Block editor (hq-3ed2c3): the Notion-style edit surface over a markdown
	 * document. Blocks are the markdown's blank-line-separated segments; each
	 * edits independently and SAVES INDEPENDENTLY — per the ADR the conflict
	 * policy is last-write-wins PER BLOCK: a save re-reads the fresh document,
	 * splices only the edited block into it, and writes with the fresh version,
	 * so two users editing different blocks never clobber each other (same
	 * block: last write wins). CRDT is explicitly out of scope.
	 */
	import { invalidateAll } from '$app/navigation';
	import { browserDocs, type DocumentRow } from '$lib/api/documents';
	import { TrackerError } from '$lib/api/tracker';
	import { Markdown } from '$lib/components/ui';

	interface Props {
		doc: DocumentRow;
		editedBy: string;
		canWrite: boolean;
	}
	let { doc, editedBy, canWrite }: Props = $props();

	const SEP = '\n\n';
	const blocks = $derived((doc.body_md ?? '').split(SEP));

	let editing = $state<number | null>(null);
	let draft = $state('');
	let busy = $state(false);
	let error = $state('');

	function start(i: number) {
		if (!canWrite) return;
		editing = i;
		draft = blocks[i] ?? '';
		error = '';
	}

	/** Splice `value` in as block `i` of the FRESH body (LWW per block). */
	async function save(i: number, value: string, remove = false) {
		busy = true;
		error = '';
		try {
			const fresh = await browserDocs().get(doc.id);
			const freshBlocks = (fresh.body_md ?? '').split(SEP);
			if (remove) freshBlocks.splice(i, 1);
			else if (i >= freshBlocks.length) freshBlocks.push(value);
			else freshBlocks[i] = value;
			await browserDocs().update(doc.id, {
				expected_version: fresh.version,
				edited_by: editedBy,
				body_md: freshBlocks.join(SEP)
			});
			editing = null;
			await invalidateAll();
		} catch (e) {
			error = e instanceof TrackerError ? `${e.status}: ${e.message}` : String(e);
		} finally {
			busy = false;
		}
	}

	const addBlock = () => save(blocks.length, draft || ' ', false);
</script>

<div class="space-y-1">
	{#if error}<p class="text-sm text-[var(--gw-color-error)]">{error}</p>{/if}

	{#each blocks as block, i (i)}
		{#if editing === i}
			<div class="rounded-lg border border-[var(--gw-color-primary)] p-2">
				<textarea
					class="textarea w-full font-[family-name:var(--gw-font-mono)]"
					rows={Math.max(3, draft.split('\n').length + 1)}
					bind:value={draft}
				></textarea>
				<div class="mt-1 flex gap-2 text-sm">
					<button
						class="rounded bg-[var(--gw-color-primary)] px-2 py-1 text-white disabled:opacity-50"
						disabled={busy}
						onclick={() => save(i, draft)}
					>{busy ? 'Guardando…' : 'Guardar bloque'}</button>
					<button class="rounded border border-[var(--gw-color-border)] px-2 py-1" onclick={() => (editing = null)}>Cancelar</button>
					<button
						class="ml-auto rounded px-2 py-1 text-[var(--gw-color-error)]"
						disabled={busy}
						onclick={() => save(i, '', true)}
					>Eliminar bloque</button>
				</div>
			</div>
		{:else}
			<div
				class="group relative rounded-lg p-1 {canWrite ? 'hover:bg-[var(--gw-color-surface-2)]' : ''}"
				role="presentation"
				ondblclick={() => start(i)}
			>
				<Markdown text={block || ' '} />
				{#if canWrite}
					<button
						class="absolute right-1 top-1 hidden rounded border border-[var(--gw-color-border)] bg-[var(--gw-color-surface)] px-1.5 py-0.5 text-xs group-hover:block"
						onclick={() => start(i)}
					>✎</button>
				{/if}
			</div>
		{/if}
	{/each}

	{#if canWrite && editing === null}
		<button
			class="w-full rounded-lg border border-dashed border-[var(--gw-color-border)] py-1.5 text-xs text-[var(--gw-color-text-muted)] hover:border-[var(--gw-color-primary)]"
			onclick={() => {
				draft = '';
				editing = blocks.length;
			}}
		>+ bloque</button>
	{/if}
	{#if editing !== null && editing >= blocks.length}
		<div class="rounded-lg border border-[var(--gw-color-primary)] p-2">
			<textarea class="textarea w-full font-[family-name:var(--gw-font-mono)]" rows="4" bind:value={draft}></textarea>
			<div class="mt-1 flex gap-2 text-sm">
				<button
					class="rounded bg-[var(--gw-color-primary)] px-2 py-1 text-white disabled:opacity-50"
					disabled={busy || !draft.trim()}
					onclick={addBlock}
				>Añadir</button>
				<button class="rounded border border-[var(--gw-color-border)] px-2 py-1" onclick={() => (editing = null)}>Cancelar</button>
			</div>
		</div>
	{/if}
</div>
