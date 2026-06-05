<script lang="ts">
	import { goto } from '$app/navigation';
	import { browserDocs, type DocOwnerType } from '$lib/api/documents';
	import { TrackerError } from '$lib/api/tracker';
	import { Button } from '$lib/ui';

	interface Props {
		createdBy: string;
		onclose: () => void;
	}

	let { createdBy, onclose }: Props = $props();

	let ownerType = $state<DocOwnerType>('epic');
	let ownerId = $state('');
	let filename = $state('');
	let bodyMd = $state('');
	let error = $state('');
	let saving = $state(false);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		saving = true;
		error = '';
		try {
			const doc = await browserDocs().attach({
				owner_type: ownerType,
				owner_id: ownerId.trim(),
				kind: 'md',
				filename: filename.trim(),
				body_md: bodyMd,
				created_by: createdBy
			});
			onclose();
			await goto(`/knowledge/${encodeURIComponent(doc.id)}`);
		} catch (err) {
			error = err instanceof TrackerError ? err.message : String(err);
		} finally {
			saving = false;
		}
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onclick={onclose}>
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
	<div
		class="card preset-filled-surface-100-900 w-full max-w-lg p-5"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => e.stopPropagation()}
	>
		<h2 class="h3 mb-3">New document</h2>
		<form class="space-y-3" onsubmit={submit}>
			<div class="grid grid-cols-2 gap-3">
				<label class="label">
					<span class="label-text">owner type</span>
					<select class="select" bind:value={ownerType}>
						<option value="epic">epic</option>
						<option value="skill">skill</option>
						<option value="spec">spec</option>
					</select>
				</label>
				<label class="label">
					<span class="label-text">owner id</span>
					<input class="input" bind:value={ownerId} placeholder="hq-epic" required />
				</label>
			</div>
			<label class="label">
				<span class="label-text">filename</span>
				<input class="input" bind:value={filename} placeholder="design.md" required />
			</label>
			<label class="label">
				<span class="label-text">body (markdown)</span>
				<textarea class="textarea" rows="6" bind:value={bodyMd} required></textarea>
			</label>

			{#if error}<p class="text-sm text-error-500">{error}</p>{/if}

			<div class="flex justify-end gap-2">
				<Button variant="tonal" type="button" onclick={onclose}>Cancel</Button>
				<Button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create'}</Button>
			</div>
		</form>
	</div>
</div>
