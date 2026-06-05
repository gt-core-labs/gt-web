<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { browserTracker, TrackerError } from '$lib/api/tracker';
	import { Button } from '$lib/ui';

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
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
	role="presentation"
	onclick={onclose}
>
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
	<div
		class="card preset-filled-surface-100-900 w-full max-w-lg p-5"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => e.stopPropagation()}
	>
		<h2 class="h3 mb-3">New bead</h2>
		<form class="space-y-3" onsubmit={submit}>
			<div class="grid grid-cols-2 gap-3">
				<label class="label">
					<span class="label-text">id</span>
					<input class="input" bind:value={id} placeholder="hq-epic.1" required />
				</label>
				<label class="label">
					<span class="label-text">type</span>
					<input class="input" bind:value={issueType} required />
				</label>
			</div>
			<label class="label">
				<span class="label-text">title</span>
				<input class="input" bind:value={title} required />
			</label>
			<div class="grid grid-cols-3 gap-3">
				<label class="label col-span-1">
					<span class="label-text">epic (external_ref)</span>
					<input class="input" bind:value={externalRef} placeholder="hq-epic" />
				</label>
				<label class="label col-span-1">
					<span class="label-text">domain (csv)</span>
					<input class="input" bind:value={domain} required />
				</label>
				<label class="label col-span-1">
					<span class="label-text">priority</span>
					<select class="select" bind:value={priority}>
						<option value={0}>P0</option>
						<option value={1}>P1</option>
						<option value={2}>P2</option>
					</select>
				</label>
			</div>
			<label class="label">
				<span class="label-text">description</span>
				<textarea class="textarea" rows="3" bind:value={description}></textarea>
			</label>

			{#if error}<p class="text-sm text-error-500">{error}</p>{/if}

			<div class="flex justify-end gap-2">
				<Button variant="tonal" type="button" onclick={onclose}>Cancel</Button>
				<Button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create'}</Button>
			</div>
		</form>
	</div>
</div>
