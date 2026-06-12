<script lang="ts">
	/**
	 * depends_on editor (hq-039316): chips with ✕ to drop an edge + a combobox
	 * (id / title substring filter) to add one. Emits the FULL list — the backend
	 * PATCH replaces `depends_on` wholesale (gt-issues UpdateIssue).
	 *
	 * Custom dropdown, NOT a native datalist: with hundreds of beads the browser
	 * rendered an unbounded suggestion panel covering the viewport (hq-f3174d).
	 */
	interface Props {
		ids: string[];
		/** Candidate issues for the suggestions (the board's rows). */
		options: { id: string; title: string }[];
		disabled?: boolean;
		onchange: (ids: string[]) => void;
	}
	let { ids, options, disabled = false, onchange }: Props = $props();

	/** Rendered-suggestion cap — the filter narrows long lists, not scrolling. */
	const MAX_SUGGESTIONS = 30;

	let draft = $state('');
	let open = $state(false);
	let active = $state(0);
	let inputEl = $state<HTMLInputElement | null>(null);
	// Fixed-position anchor: the drawer scroll container clips an absolute
	// dropdown, so the list overlays at viewport coords instead (hq-f3174d).
	let anchor = $state({ top: 0, left: 0, width: 0 });

	function place() {
		const r = inputEl?.getBoundingClientRect();
		if (r) anchor = { top: r.bottom + 4, left: r.left, width: r.width };
	}
	function show() {
		place();
		open = true;
	}

	const candidates = $derived(options.filter((o) => !ids.includes(o.id)));
	const matches = $derived.by(() => {
		const q = draft.trim().toLowerCase();
		const pool = q
			? candidates.filter(
					(o) => o.id.toLowerCase().includes(q) || o.title.toLowerCase().includes(q)
				)
			: candidates;
		return pool.slice(0, MAX_SUGGESTIONS);
	});

	function add(id: string) {
		if (!id || ids.includes(id)) return;
		draft = '';
		open = false;
		onchange([...ids, id]);
	}
	function remove(id: string) {
		onchange(ids.filter((x) => x !== id));
	}
	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			open = false;
			return;
		}
		if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
			open = true;
			return;
		}
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			active = Math.min(active + 1, matches.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			active = Math.max(active - 1, 0);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			const pick = matches[active]?.id ?? draft.trim();
			add(pick);
		}
	}
	// Clamp the highlight when the filter shrinks the list.
	$effect(() => {
		if (active >= matches.length) active = Math.max(matches.length - 1, 0);
	});
</script>

<!-- Re-anchor on viewport changes; capture phase also catches the drawer's inner scroll. -->
<svelte:window onresize={() => open && place()} onscrollcapture={() => open && place()} />

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
		<div class="relative flex gap-1">
			<input
				class="min-w-0 flex-1 rounded border border-[var(--gw-color-border)] bg-transparent px-1.5 py-0.5 font-mono text-xs"
				placeholder="Add reference (issue id)…"
				role="combobox"
				aria-expanded={open}
				aria-controls="deps-suggestions"
				aria-autocomplete="list"
				bind:this={inputEl}
				bind:value={draft}
				onfocus={show}
				oninput={show}
				onblur={() => setTimeout(() => (open = false), 150)}
				{onkeydown}
			/>
			<button
				class="rounded border border-[var(--gw-color-border)] px-2 py-0.5 text-xs disabled:opacity-50"
				type="button"
				disabled={!draft.trim()}
				onclick={() => add(draft.trim())}
			>Add</button>
			{#if open && matches.length}
				<ul
					id="deps-suggestions"
					role="listbox"
					class="fixed z-50 max-h-48 overflow-y-auto rounded-lg border border-[var(--gw-color-border)] bg-[var(--gw-color-surface)] py-1 shadow-lg"
					style="top: {anchor.top}px; left: {anchor.left}px; width: {anchor.width}px"
				>
					{#each matches as o, i (o.id)}
						<li role="option" aria-selected={i === active}>
							<button
								type="button"
								class="flex w-full items-baseline gap-2 px-2 py-1 text-left text-xs hover:bg-[var(--gw-color-surface-2)] {i === active ? 'bg-[var(--gw-color-surface-2)]' : ''}"
								onmousedown={(e) => {
									e.preventDefault(); // beat the input's blur
									add(o.id);
								}}
								onmouseenter={() => (active = i)}
							>
								<span class="shrink-0 font-mono">{o.id}</span>
								<span class="truncate text-[var(--gw-color-text-muted)]">{o.title}</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</div>
