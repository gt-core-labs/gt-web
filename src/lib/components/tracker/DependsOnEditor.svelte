<script lang="ts">
	/**
	 * depends_on editor (hq-039316): chips with ✕ to drop an edge + a datalist
	 * input (id / title) to add one. Emits the FULL list — the backend PATCH
	 * replaces `depends_on` wholesale (gt-issues UpdateIssue).
	 */
	interface Props {
		ids: string[];
		/** Candidate issues for the datalist (the board's rows). */
		options: { id: string; title: string }[];
		disabled?: boolean;
		onchange: (ids: string[]) => void;
	}
	let { ids, options, disabled = false, onchange }: Props = $props();

	let draft = $state('');
	const listId = `deps-${Math.random().toString(36).slice(2, 8)}`;
	const candidates = $derived(options.filter((o) => !ids.includes(o.id)));

	function add() {
		const id = draft.trim();
		if (!id || ids.includes(id)) return;
		draft = '';
		onchange([...ids, id]);
	}
	function remove(id: string) {
		onchange(ids.filter((x) => x !== id));
	}
</script>

<div class="space-y-1.5">
	<div class="flex flex-wrap gap-1">
		{#each ids as id (id)}
			<span
				class="inline-flex items-center gap-1 rounded bg-[var(--gw-color-surface-2)] px-1.5 py-0.5 font-mono text-[11px]"
				title={options.find((o) => o.id === id)?.title ?? id}
			>
				<a class="hover:text-[var(--gw-color-primary)] hover:underline" href="/tracker/{id}">{id}</a>
				{#if !disabled}
					<button
						class="text-[var(--gw-color-text-muted)] hover:text-[var(--gw-color-danger)]"
						onclick={() => remove(id)}
						aria-label="Remove dependency {id}"
					>✕</button>
				{/if}
			</span>
		{:else}
			<span class="text-xs text-[var(--gw-color-text-muted)]">No references.</span>
		{/each}
	</div>
	{#if !disabled}
		<form
			class="flex gap-1"
			onsubmit={(e) => {
				e.preventDefault();
				add();
			}}
		>
			<input
				class="min-w-0 flex-1 rounded border border-[var(--gw-color-border)] bg-transparent px-1.5 py-0.5 font-mono text-xs"
				list={listId}
				placeholder="Add reference (issue id)…"
				bind:value={draft}
			/>
			<datalist id={listId}>
				{#each candidates as o (o.id)}
					<option value={o.id}>{o.title}</option>
				{/each}
			</datalist>
			<button
				class="rounded border border-[var(--gw-color-border)] px-2 py-0.5 text-xs disabled:opacity-50"
				type="submit"
				disabled={!draft.trim()}
			>Add</button>
		</form>
	{/if}
</div>
