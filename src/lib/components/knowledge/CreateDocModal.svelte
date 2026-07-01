<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
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
			await goto(`${base}/knowledge/${encodeURIComponent(doc.id)}`);
		} catch (err) {
			error = err instanceof TrackerError ? err.message : String(err);
		} finally {
			saving = false;
		}
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<style>
	@keyframes dialog-in {
		from { opacity: 0; transform: scale(0.96) translateY(8px); }
		to   { opacity: 1; transform: scale(1)    translateY(0); }
	}

	.dialog {
		animation: dialog-in 300ms cubic-bezier(0.32, 0.72, 0, 1) both;
	}

	.bezel {
		border-radius: var(--gw-radius-2xl);
		border: 1px solid var(--gw-color-border-subtle);
		background-color: var(--gw-color-surface-3);
		padding: 3px;
	}

	.bezel-core {
		border-radius: calc(var(--gw-radius-2xl) - 3px);
		background-color: var(--gw-color-surface);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
	}
</style>

<!-- Backdrop — backdrop-blur allowed on fixed elements -->
<div
	class="fixed inset-0 z-40"
	style="background-color: rgba(0,0,0,0.4); backdrop-filter: blur(6px);"
	role="presentation"
	onclick={onclose}
></div>

<!-- Dialog -->
<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center p-4"
	role="presentation"
	onclick={onclose}
>
	<div
		class="dialog bezel w-full max-w-lg"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => e.stopPropagation()}
	>
		<div class="bezel-core p-[var(--gw-space-5)]">

			<!-- Modal header -->
			<div class="mb-[var(--gw-space-4)] flex items-center justify-between">
				<h2 class="text-[var(--gw-text-xl)] font-semibold text-[var(--gw-color-text)]">
					New document
				</h2>
				<button
					type="button"
					class="flex h-8 w-8 items-center justify-center rounded-full
						text-[var(--gw-color-text-muted)] opacity-60
						transition-all duration-[150ms] ease-[cubic-bezier(0.32,0.72,0,1)]
						hover:bg-[var(--gw-color-surface-3)] hover:opacity-100"
					onclick={onclose}
					aria-label="Close"
				>✕</button>
			</div>

			<form class="space-y-[var(--gw-space-3)]" onsubmit={submit}>
				<div class="grid grid-cols-2 gap-[var(--gw-space-3)]">
					<label class="block space-y-1 text-[var(--gw-text-xs)]">
						<span class="text-[var(--gw-color-text-muted)]">owner type</span>
						<select class="select" bind:value={ownerType}>
							<option value="epic">epic</option>
							<option value="skill">skill</option>
							<option value="spec">spec</option>
						</select>
					</label>
					<label class="block space-y-1 text-[var(--gw-text-xs)]">
						<span class="text-[var(--gw-color-text-muted)]">owner id</span>
						<input class="input" bind:value={ownerId} placeholder="hq-epic" required />
					</label>
				</div>
				<label class="block space-y-1 text-[var(--gw-text-xs)]">
					<span class="text-[var(--gw-color-text-muted)]">filename</span>
					<input class="input" bind:value={filename} placeholder="design.md" required />
				</label>
				<label class="block space-y-1 text-[var(--gw-text-xs)]">
					<span class="text-[var(--gw-color-text-muted)]">body (markdown)</span>
					<textarea class="textarea" rows="6" bind:value={bodyMd} required></textarea>
				</label>

				{#if error}
					<p class="text-[var(--gw-text-sm)] text-[var(--gw-color-error)]">{error}</p>
				{/if}

				<div class="flex justify-end gap-[var(--gw-space-2)]">
					<Button variant="tonal" type="button" onclick={onclose}>Cancel</Button>
					<Button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create'}</Button>
				</div>
			</form>

		</div>
	</div>
</div>
