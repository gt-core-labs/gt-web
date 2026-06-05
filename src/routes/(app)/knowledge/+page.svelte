<script lang="ts">
	import { hasScope } from '$lib/api/auth';
	import { Badge, Button, Card } from '$lib/ui';
	import CreateDocModal from '$lib/components/knowledge/CreateDocModal.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const canWrite = $derived(hasScope(data.user?.scopes, 'documents.write'));
	let showCreate = $state(false);

	type Tab = 'documents' | 'skills' | 'feed';
	let tab = $state<Tab>('documents');
	const TABS: { id: Tab; label: string }[] = [
		{ id: 'documents', label: 'Documents' },
		{ id: 'skills', label: 'Skills' },
		{ id: 'feed', label: 'Feed' }
	];
</script>

<div class="space-y-4">
	<header class="flex items-center justify-between">
		<h1 class="h2">Knowledge</h1>
		{#if canWrite && tab === 'documents'}
			<Button onclick={() => (showCreate = true)}>New document</Button>
		{/if}
	</header>

	<nav class="flex gap-1 border-b border-surface-500/20">
		{#each TABS as t (t.id)}
			<button
				class="px-3 py-2 text-sm"
				class:border-b-2={tab === t.id}
				class:border-primary-500={tab === t.id}
				class:opacity-60={tab !== t.id}
				onclick={() => (tab = t.id)}
			>
				{t.label}
			</button>
		{/each}
	</nav>

	{#if tab === 'documents'}
		<form method="GET" class="flex gap-2">
			<input class="input" type="search" name="q" value={data.q} placeholder="Search documents (full-text / hybrid)…" />
			<Button type="submit">Search</Button>
		</form>

		{#if data.docError}<p class="text-sm text-error-500">{data.docError}</p>{/if}

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
	{:else if tab === 'skills'}
		{#if data.skillsError}<p class="text-sm text-error-500">{data.skillsError}</p>{/if}
		{#if data.skills.length === 0}
			<p class="opacity-60">No skills registered.</p>
		{:else}
			<ul class="grid grid-cols-2 gap-2">
				{#each data.skills as s (s.id)}
					<li>
						<Card>
							<div class="flex items-center justify-between gap-2">
								<span class="font-medium">{s.label}</span>
								<span class="font-mono text-xs opacity-60">{s.id}</span>
							</div>
							<p class="mt-1 text-sm opacity-70">{s.description}</p>
							<div class="mt-2 flex flex-wrap gap-1">
								{#each s.default_scopes as sc (sc)}<Badge variant="surface">{sc}</Badge>{/each}
							</div>
						</Card>
					</li>
				{/each}
			</ul>
		{/if}
	{:else}
		{#if data.feedError}<p class="text-sm text-error-500">{data.feedError}</p>{/if}
		{#if data.feed.length === 0}
			<p class="opacity-60">No recent events.</p>
		{:else}
			<ul class="space-y-1 text-sm">
				{#each data.feed as e (e.event_id)}
					<li class="flex items-center gap-2">
						<Badge variant="primary">{e.kind}</Badge>
						<span class="opacity-60">{new Date(e.ts).toLocaleString()}</span>
						<span class="truncate font-mono text-xs opacity-50">{e.correlation_id}</span>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>

{#if showCreate}
	<CreateDocModal createdBy={data.user?.sub ?? 'gt-web'} onclose={() => (showCreate = false)} />
{/if}
