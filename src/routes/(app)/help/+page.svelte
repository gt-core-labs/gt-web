<script lang="ts">
	import { enhance } from '$app/forms';
	import { hasScope } from '$lib/api/auth';
	import { Badge, Button, Card } from '$lib/ui';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const canReport = $derived(hasScope(data.user?.scopes, 'meta.write'));

	let gapOperation = $state('');
	let filter = $state('');
	const tools = $derived(
		data.tools
			.filter((t) => {
				const q = filter.trim().toLowerCase();
				if (!q) return true;
				return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
			})
			.sort((a, b) => a.name.localeCompare(b.name))
	);

	let saving = $state(false);
	const enhancer = () => {
		saving = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			saving = false;
		};
	};
</script>

<div class="space-y-6">
	<header class="flex items-center justify-between">
		<h1 class="h2">Help <span class="text-base opacity-60">({data.tools.length} tools)</span></h1>
	</header>

	<div class="grid gap-6 lg:grid-cols-[1fr_22rem]">
		<!-- Tool / operation catalog -->
		<section class="space-y-3">
			<input
				type="search"
				bind:value={filter}
				placeholder="Filter operations…"
				class="input"
				aria-label="Filter operations"
			/>
			<div class="space-y-2">
				{#each tools as tool (tool.name)}
					<Card class="p-3">
						<div class="flex items-baseline justify-between gap-3">
							<code class="text-sm font-medium">{tool.name}</code>
							{#if canReport}
								<button
									type="button"
									class="text-xs underline opacity-70 hover:opacity-100"
									onclick={() => (gapOperation = tool.name)}
								>
									Report gap
								</button>
							{/if}
						</div>
						<p class="mt-1 text-sm opacity-70">{tool.description}</p>
					</Card>
				{/each}
				{#if tools.length === 0}
					<p class="py-6 text-center opacity-60">No operations match.</p>
				{/if}
			</div>
		</section>

		<!-- Report-gap form -->
		<aside class="space-y-3">
			<h2 class="h4">Report a gap</h2>
			{#if !canReport}
				<p class="text-sm opacity-60">Requires the <code>meta.write</code> scope.</p>
			{:else}
				{#if form?.ok && form.bead}
					<Badge variant="success">Filed {form.bead}</Badge>
				{/if}
				{#if form?.error}<p class="text-sm text-error-500">{form.error}</p>{/if}
				<form method="POST" action="?/report" use:enhance={enhancer} class="space-y-3">
					<label class="label">
						<span>Operation <span class="text-error-500">*</span></span>
						<input name="operation" bind:value={gapOperation} required class="input" placeholder="domain.action" />
					</label>
					<label class="label">
						<span>Notes</span>
						<textarea name="notes" rows="3" class="textarea" placeholder="What's missing and why."></textarea>
					</label>
					<label class="label">
						<span>Priority</span>
						<input name="priority" type="number" min="0" class="input" placeholder="(optional)" />
					</label>
					<label class="label">
						<span>Epic / external ref</span>
						<input name="external_ref" class="input" placeholder="hq-… (optional)" />
					</label>
					<label class="label">
						<span>Domains</span>
						<input name="domain" class="input" placeholder="comma-separated (optional)" />
					</label>
					<label class="label">
						<span>Surfaces</span>
						<input name="surface" class="input" placeholder="comma-separated paths (optional)" />
					</label>
					<Button type="submit" variant="filled" disabled={saving}>
						{saving ? 'Filing…' : 'Report gap'}
					</Button>
				</form>
			{/if}
		</aside>
	</div>
</div>
