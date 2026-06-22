<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { browserTracker, ISSUE_TYPES, TrackerError } from '$lib/api/tracker';

	interface Props {
		createdBy: string;
		/** Bead namespace — the server generates `{rig}-{6hex}` (hq-bead-id-standard.1). */
		rig: string;
		/** Board project key the card lands in (hq-62130a); `default` when omitted. */
		workspace?: string;
		/** The scope's epics for the Epic ref select (NN-16: required on non-epics). */
		epics?: { id: string; title: string }[];
		/**
		 * The closed Domain set (gt-meta, sourced server-side). When non-empty the
		 * field renders a multi-select so an out-of-set value can't be submitted
		 * (gtweb-186fbf). Empty ⇒ the session lacked `meta.read`; degrade to a
		 * free-text CSV input so the modal still works.
		 */
		domainOptions?: string[];
		onclose: () => void;
	}

	let { createdBy, rig, workspace = 'default', epics = [], domainOptions = [], onclose }: Props =
		$props();

	let title = $state('');
	let issueType = $state('task');
	let parentId = $state('');
	// Selected domains (closed-set picker) + a CSV fallback string for the no-catalog path.
	let selectedDomains = $state<Set<string>>(new Set());
	let domainText = $state('');
	let priority = $state(2);
	let description = $state('');
	let error = $state('');
	let saving = $state(false);

	const isEpic = $derived(issueType === 'epic');

	// Render the closed-set picker when the backend gave us a catalog; otherwise free text.
	const useSelect = $derived(domainOptions.length > 0);

	// Display order for the dotted-name tiers; unknown tiers sort to the end, alphabetically.
	const TIER_ORDER = [
		'kernel',
		'lifecycle',
		'orch',
		'platform',
		'role',
		'bin',
		'store',
		'fe',
		'deploy',
		'docs',
		'meta'
	];
	const tierRank = (t: string) => {
		const i = TIER_ORDER.indexOf(t);
		return i === -1 ? TIER_ORDER.length : i;
	};

	// Group the closed set by tier (segment before the first dot) for the picker.
	const groupedDomains = $derived.by(() => {
		const m = new Map<string, string[]>();
		for (const d of [...domainOptions].sort()) {
			const tier = d.split('.')[0];
			if (!m.has(tier)) m.set(tier, []);
			m.get(tier)!.push(d);
		}
		return [...m.entries()].sort((a, b) => tierRank(a[0]) - tierRank(b[0]) || a[0].localeCompare(b[0]));
	});

	function toggleDomain(d: string) {
		const next = new Set(selectedDomains);
		if (next.has(d)) next.delete(d);
		else next.add(d);
		selectedDomains = next;
	}

	// The domains to submit, from whichever input is active.
	const domainList = $derived(
		useSelect
			? [...selectedDomains]
			: domainText
					.split(',')
					.map((s) => s.trim())
					.filter(Boolean)
	);
	// NN: a non-epic needs ≥1 domain; epics may have none.
	const domainValid = $derived(isEpic || domainList.length > 0);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!domainValid) {
			error = 'Pick at least one domain.';
			return;
		}
		saving = true;
		error = '';
		try {
			await browserTracker().create({
				rig,
				workspace,
				title: title.trim(),
				issue_type: issueType,
				created_by: createdBy,
				// child_of relation (NN-16 requires a parent epic for non-epics).
				parent_id: isEpic ? undefined : parentId,
				domain: domainList,
				priority: Number(priority),
				description: description.trim() || undefined
			});
			await invalidateAll();
			onclose();
		} catch (err) {
			error = err instanceof TrackerError ? err.message : String(err);
		} finally {
			saving = false;
		}
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<!-- Backdrop — fixed, so backdrop-blur is safe here (no scrolling container). -->
<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl"
	style="background: rgba(0,0,0,0.55)"
	role="presentation"
	onclick={onclose}
>
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->

	<!-- Dialog — Double-Bezel -->
	<div
		class="w-full max-w-lg"
		role="dialog"
		aria-modal="true"
		aria-labelledby="create-bead-title"
		tabindex="-1"
		onclick={(e) => e.stopPropagation()}
	>
		<!-- Outer shell -->
		<div class="rounded-[1.75rem] border border-[var(--gw-color-border)] bg-[var(--gw-color-border)]/30 p-[3px]">
			<!-- Inner core -->
			<div class="rounded-[calc(1.75rem-3px)] bg-[var(--gw-color-surface)] px-6 py-7 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] sm:px-8">

				<div class="mb-6 flex items-center justify-between">
					<h2 id="create-bead-title" class="text-lg font-semibold tracking-tight text-[var(--gw-color-text)]">
						New bead
					</h2>
					<button
						type="button"
						onclick={onclose}
						class="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--gw-color-border)] text-[var(--gw-color-text-muted)]
							transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]
							hover:border-[var(--gw-color-text-muted)] hover:text-[var(--gw-color-text)]
							focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gw-color-primary-focus)]"
						aria-label="Close"
					>
						<svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
							<path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
						</svg>
					</button>
				</div>

				<form class="flex flex-col gap-4" onsubmit={submit}>
					<div class="grid grid-cols-2 gap-3">
						<div class="flex flex-col gap-1.5">
							<label for="bead-type" class="field-label">Type</label>
							<div class="field-wrap">
								<select id="bead-type" class="field-input" bind:value={issueType} required>
									{#each ISSUE_TYPES as t (t)}<option value={t}>{t}</option>{/each}
								</select>
							</div>
						</div>
						<div class="flex flex-col gap-1.5">
							<label for="bead-priority" class="field-label">Priority</label>
							<div class="field-wrap">
								<select id="bead-priority" class="field-input" bind:value={priority}>
									<option value={0}>P0</option>
									<option value={1}>P1</option>
									<option value={2}>P2</option>
								</select>
							</div>
						</div>
					</div>

					<div class="flex flex-col gap-1.5">
						<label for="bead-title" class="field-label">Title</label>
						<div class="field-wrap">
							<input id="bead-title" class="field-input" bind:value={title} required />
						</div>
					</div>

					{#if !isEpic}
						<div class="flex flex-col gap-1.5">
							<label for="bead-epic" class="field-label">Epic</label>
							<div class="field-wrap">
								<select id="bead-epic" class="field-input" bind:value={parentId} required>
									<option value="" disabled>— pick an epic —</option>
									{#each epics as e (e.id)}
										<option value={e.id}>{e.title} ({e.id})</option>
									{/each}
								</select>
							</div>
						</div>
					{/if}

					<div class="flex flex-col gap-1.5">
						<div class="flex items-baseline justify-between">
							<span class="field-label">Domain</span>
							{#if useSelect}
								<span class="field-label normal-case tracking-normal opacity-60">
									{selectedDomains.size} selected{isEpic ? '' : ' · ≥1 required'}
								</span>
							{:else}
								<span class="field-label normal-case tracking-normal opacity-60">csv</span>
							{/if}
						</div>
						{#if useSelect}
							<!-- Closed-set picker (gt-meta): only listed domains can be chosen/submitted. -->
							<div class="domain-box" role="group" aria-label="Domain">
								{#each groupedDomains as [tier, vals] (tier)}
									<div class="domain-group">
										<div class="domain-tier">{tier}</div>
										<div class="domain-chips">
											{#each vals as v (v)}
												<button
													type="button"
													class="chip"
													class:chip-on={selectedDomains.has(v)}
													aria-pressed={selectedDomains.has(v)}
													onclick={() => toggleDomain(v)}
												>
													{v}
												</button>
											{/each}
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<!-- Fallback when the session lacks `meta.read`: validated free-text CSV. -->
							<div class="field-wrap">
								<input
									id="bead-domain"
									class="field-input"
									bind:value={domainText}
									placeholder="fe.web, fe.docs"
									required={!isEpic}
								/>
							</div>
						{/if}
					</div>

					<div class="flex flex-col gap-1.5">
						<label for="bead-desc" class="field-label">Description</label>
						<div class="field-wrap">
							<textarea id="bead-desc" class="field-input resize-none" rows="3" bind:value={description}></textarea>
						</div>
					</div>

					{#if error}
						<div class="rounded-2xl border border-[var(--color-error-500)]/30 bg-[var(--color-error-500)]/8 px-4 py-2.5 text-sm text-[var(--color-error-500)]">
							{error}
						</div>
					{/if}

					<div class="flex items-center justify-end gap-2 pt-1">
						<button
							type="button"
							onclick={onclose}
							class="rounded-full border border-[var(--gw-color-border)] px-4 py-2 text-sm font-medium text-[var(--gw-color-text-muted)]
								transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
								hover:border-[var(--gw-color-text-muted)] hover:text-[var(--gw-color-text)]
								active:scale-[0.98]
								focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gw-color-primary-focus)]"
						>
							Cancel
						</button>
						<!-- Button-in-Button -->
						<button
							type="submit"
							disabled={saving || !domainValid}
							class="group flex items-center gap-2 rounded-full bg-[var(--gw-color-primary)] px-5 py-2 text-sm font-medium text-white
								transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
								hover:opacity-90 active:scale-[0.98]
								disabled:cursor-not-allowed disabled:opacity-40
								focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gw-color-primary-focus)] focus-visible:ring-offset-2"
						>
							{saving ? 'Creating…' : 'Create'}
							{#if !saving}
								<span class="flex h-5 w-5 items-center justify-center rounded-full bg-white/15 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px">
									<svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
										<path d="M1.5 8.5L8.5 1.5M8.5 1.5H3.5M8.5 1.5V6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
									</svg>
								</span>
							{/if}
						</button>
					</div>
				</form>

			</div>
		</div>
	</div>
</div>

<style>
	.field-label {
		font-size: 10px;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--gw-color-text-muted);
	}
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

	/* Closed-set Domain picker (gtweb-186fbf): tier-grouped, scrollable chip list. */
	.domain-box {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		max-height: 11rem;
		overflow-y: auto;
		border-radius: 0.75rem;
		border: 1px solid var(--gw-color-border);
		background: var(--gw-color-surface-2);
		padding: 0.625rem 0.75rem;
	}
	.domain-group {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}
	.domain-tier {
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: color-mix(in oklch, var(--gw-color-text-muted) 80%, transparent);
	}
	.domain-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}
	.chip {
		border-radius: 9999px;
		border: 1px solid var(--gw-color-border);
		background: transparent;
		padding: 0.2rem 0.6rem;
		font-size: 0.75rem;
		line-height: 1.1;
		color: var(--gw-color-text-muted);
		cursor: pointer;
		transition:
			border-color 0.2s cubic-bezier(0.32, 0.72, 0, 1),
			background 0.2s cubic-bezier(0.32, 0.72, 0, 1),
			color 0.2s cubic-bezier(0.32, 0.72, 0, 1);
	}
	.chip:hover {
		border-color: var(--gw-color-text-muted);
		color: var(--gw-color-text);
	}
	.chip:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px color-mix(in oklch, var(--gw-color-primary) 20%, transparent);
	}
	.chip-on {
		border-color: var(--gw-color-primary);
		background: color-mix(in oklch, var(--gw-color-primary) 16%, transparent);
		color: var(--gw-color-text);
	}
</style>
