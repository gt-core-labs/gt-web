<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { browserTracker, TrackerError } from '$lib/api/tracker';
	import { Button } from '$lib/ui';
	import { Alert } from '$lib/components/ui';

	interface Props {
		createdBy: string;
		onclose: () => void;
	}

	let { createdBy, onclose }: Props = $props();

	let id = $state('');
	let title = $state('');
	let issueType = $state('task');
	let externalRef = $state('');
	let domain = $state('fe.web');
	let priority = $state(2);
	let description = $state('');
	let error = $state('');
	let saving = $state(false);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		saving = true;
		error = '';
		try {
			await browserTracker().create({
				id: id.trim(),
				title: title.trim(),
				issue_type: issueType.trim(),
				created_by: createdBy,
				external_ref: externalRef.trim() || undefined,
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

	// Shared field styling. `fieldBase` mirrors the token-driven states of the
	// `Input` primitive but stays on native elements so two-way `bind:value` works
	// (the primitive's `value` is not $bindable).
	const fieldLabel = 'text-[var(--gw-text-xs)] font-medium text-[var(--gw-color-text-muted)]';
	const fieldBase =
		'w-full transition-[border-color,box-shadow] duration-[var(--gw-duration-fast)] ' +
		'hover:border-[var(--gw-color-primary)] focus-visible:border-[var(--gw-color-primary)] ' +
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gw-color-primary-focus)]/30 ' +
		'disabled:cursor-not-allowed disabled:opacity-50';
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-[var(--gw-space-4)]"
	role="presentation"
	onclick={onclose}
>
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
	<div
		class="w-full max-w-lg rounded-[var(--gw-radius-xl)] border border-[var(--gw-color-border-subtle)]
			bg-[var(--gw-color-surface)] p-[var(--gw-space-5)] shadow-[var(--gw-shadow-xl)]"
		role="dialog"
		aria-modal="true"
		aria-labelledby="create-bead-title"
		tabindex="-1"
		onclick={(e) => e.stopPropagation()}
	>
		<h2
			id="create-bead-title"
			class="mb-[var(--gw-space-4)] text-[var(--gw-text-xl)] font-semibold tracking-tight text-[var(--gw-color-text)]"
		>
			New bead
		</h2>
		<form class="space-y-[var(--gw-space-3)]" onsubmit={submit}>
			<div class="grid grid-cols-2 gap-[var(--gw-space-3)]">
				<label class="space-y-[var(--gw-space-1)]">
					<span class={fieldLabel}>id</span>
					<input class="input {fieldBase}" bind:value={id} placeholder="hq-epic.1" required />
				</label>
				<label class="space-y-[var(--gw-space-1)]">
					<span class={fieldLabel}>type</span>
					<input class="input {fieldBase}" bind:value={issueType} required />
				</label>
			</div>
			<label class="space-y-[var(--gw-space-1)]">
				<span class={fieldLabel}>title</span>
				<input class="input {fieldBase}" bind:value={title} required />
			</label>
			<div class="grid grid-cols-3 gap-[var(--gw-space-3)]">
				<label class="col-span-1 space-y-[var(--gw-space-1)]">
					<span class={fieldLabel}>epic (external_ref)</span>
					<input class="input {fieldBase}" bind:value={externalRef} placeholder="hq-epic" />
				</label>
				<label class="col-span-1 space-y-[var(--gw-space-1)]">
					<span class={fieldLabel}>domain (csv)</span>
					<input class="input {fieldBase}" bind:value={domain} required />
				</label>
				<label class="col-span-1 space-y-[var(--gw-space-1)]">
					<span class={fieldLabel}>priority</span>
					<select class="select {fieldBase}" bind:value={priority}>
						<option value={0}>P0</option>
						<option value={1}>P1</option>
						<option value={2}>P2</option>
					</select>
				</label>
			</div>
			<label class="space-y-[var(--gw-space-1)]">
				<span class={fieldLabel}>description</span>
				<textarea class="textarea {fieldBase}" rows="3" bind:value={description}></textarea>
			</label>

			{#if error}<Alert variant="error">{error}</Alert>{/if}

			<div class="flex justify-end gap-[var(--gw-space-2)] pt-[var(--gw-space-1)]">
				<Button variant="tonal" type="button" onclick={onclose}>Cancel</Button>
				<Button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create'}</Button>
			</div>
		</form>
	</div>
</div>
