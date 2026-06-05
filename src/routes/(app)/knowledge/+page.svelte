<script lang="ts">
	import { hasScope } from '$lib/api/auth';
	import { Badge, Button, Card } from '$lib/ui';
	import CreateDocModal from '$lib/components/knowledge/CreateDocModal.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const canWrite = $derived(hasScope(data.user?.scopes, 'documents.write'));
	let showCreate = $state(false);

	// Skills + Feed REST are not mounted yet (backend hq-web-extras.13/.14);
	// surface them as coming-soon tabs rather than dead links.
	const TABS = [
		{ id: 'documents', label: 'Documents', ready: true },
		{ id: 'skills', label: 'Skills', ready: false },
		{ id: 'feed', label: 'Feed', ready: false }
	];
</script>

<div class="space-y-4">
	<header class="flex items-center justify-between">
		<h1 class="h2">Knowledge</h1>
		{#if canWrite}
			<Button onclick={() => (showCreate = true)}>New document</Button>
		{/if}
	</header>

	<nav class="flex gap-1 border-b border-surface-500/20">
		{#each TABS as t (t.id)}
			<span
				class="px-3 py-2 text-sm"
				class:border-b-2={t.ready}
				class:border-primary-500={t.ready}
				class:opacity-40={!t.ready}
			>
				{t.label}{#if !t.ready}<span class="ml-1 text-xs">(soon)</span>{/if}
			</span>
		{/each}
	</nav>

	<form method="GET" class="flex gap-2">
		<input
			class="input"
			type="search"
			name="q"
			value={data.q}
			placeholder="Search documents (full-text / hybrid)…"
		/>
		<Button type="submit">Search</Button>
	</form>

	{#if data.error}<p class="text-sm text-error-500">{data.error}</p>{/if}

	{#if !data.q}
		<p class="opacity-60">Enter a query to search the knowledge base.</p>
	{:else if data.results.length === 0}
		<p class="opacity-60">No documents match “{data.q}”.</p>
	{:else}
		<ul class="space-y-2">
			{#each data.results as doc (doc.id)}
				<li>
					<a href={`/knowledge/${doc.id}`} class="block">
						<Card>
							<div class="flex items-center justify-between gap-2">
								<span class="font-medium">{doc.filename}</span>
								<Badge variant="surface">{doc.kind}</Badge>
							</div>
							<div class="text-xs opacity-60">{doc.owner_type}:{doc.owner_id} · v{doc.version}</div>
							{#if doc.body_md || doc.extracted_text}
								<p class="mt-1 line-clamp-2 text-sm opacity-70">
									{(doc.body_md ?? doc.extracted_text ?? '').slice(0, 200)}
								</p>
							{/if}
						</Card>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>

{#if showCreate}
	<CreateDocModal createdBy={data.user?.sub ?? 'gt-web'} onclose={() => (showCreate = false)} />
{/if}
