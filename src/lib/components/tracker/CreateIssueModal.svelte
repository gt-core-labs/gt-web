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
		onclose: () => void;
	}

	let { createdBy, rig, workspace = 'default', epics = [], onclose }: Props = $props();

	let title = $state('');
	let issueType = $state('task');
	let externalRef = $state('');
	let domain = $state('fe.web');
	let priority = $state(2);
	let description = $state('');
	let error = $state('');
	let saving = $state(false);

	const isEpic = $derived(issueType === 'epic');

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		saving = true;
		error = '';
		try {
			await browserTracker().create({
				rig,
				workspace,
				title: title.trim(),
				issue_type: issueType,
				created_by: createdBy,
				external_ref: isEpic ? undefined : externalRef,
				domain: domain
					.split(',')
					.map((s) => s.trim())
					.filter(Boolean),
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

					<div class="grid grid-cols-2 gap-3">
						{#if !isEpic}
							<div class="flex flex-col gap-1.5">
								<label for="bead-epic" class="field-label">Epic</label>
								<div class="field-wrap">
									<select id="bead-epic" class="field-input" bind:value={externalRef} required>
										<option value="" disabled>— pick an epic —</option>
										{#each epics as e (e.id)}
											<option value={e.id}>{e.title} ({e.id})</option>
										{/each}
									</select>
								</div>
							</div>
						{/if}
						<div class="flex flex-col gap-1.5" class:col-span-2={isEpic}>
							<label for="bead-domain" class="field-label">Domain <span class="normal-case tracking-normal opacity-60">csv</span></label>
							<div class="field-wrap">
								<input id="bead-domain" class="field-input" bind:value={domain} required />
							</div>
						</div>
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
							disabled={saving}
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
</style>
