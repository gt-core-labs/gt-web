<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { browserDocs } from '$lib/api/documents';
	import { TrackerError } from '$lib/api/tracker';
	import { hasScope } from '$lib/api/auth';
	import { Badge, Button, Card } from '$lib/ui';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const doc = $derived(data.doc);
	const canWrite = $derived(hasScope(data.user?.scopes, 'documents.write'));

	let editing = $state(false);
	let filename = $state('');
	let bodyMd = $state('');
	let error = $state('');
	let busy = $state(false);

	function startEdit() {
		filename = doc.filename;
		bodyMd = doc.body_md ?? '';
		editing = true;
		error = '';
	}

	async function save() {
		busy = true;
		error = '';
		try {
			await browserDocs().update(doc.id, {
				expected_version: doc.version,
				edited_by: data.user?.sub ?? 'gt-web',
				filename,
				body_md: bodyMd
			});
			editing = false;
			await invalidateAll();
		} catch (err) {
			error = err instanceof TrackerError ? `${err.status}: ${err.message}` : String(err);
		} finally {
			busy = false;
		}
	}

	async function remove() {
		if (!confirm(`Delete ${doc.filename}?`)) return;
		busy = true;
		error = '';
		try {
			await browserDocs().remove(doc.id, doc.version);
			await goto('/knowledge');
		} catch (err) {
			error = err instanceof TrackerError ? `${err.status}: ${err.message}` : String(err);
			busy = false;
		}
	}
</script>

<div class="mx-auto max-w-3xl space-y-4">
	<a href="/knowledge" class="text-sm opacity-70 hover:underline">← Knowledge</a>

	<header class="space-y-1">
		<div class="flex items-center gap-2">
			<h1 class="h2">{doc.filename}</h1>
			<Badge variant="surface">{doc.kind}</Badge>
			<Badge variant="primary">v{doc.version}</Badge>
		</div>
		<div class="flex flex-wrap gap-x-4 text-sm opacity-70">
			<span>{doc.owner_type}:{doc.owner_id}</span>
			{#if doc.content_type}<span>{doc.content_type}</span>{/if}
			{#if doc.uploaded_by}<span>by {doc.uploaded_by}</span>{/if}
			<span>{new Date(doc.uploaded_at).toLocaleString()}</span>
		</div>
	</header>

	{#if error}<p class="text-sm text-error-500">{error}</p>{/if}

	{#if canWrite && !editing}
		<div class="flex gap-2">
			<Button variant="tonal" onclick={startEdit}>Edit</Button>
			<Button variant="tonal" disabled={busy} onclick={remove}>Delete</Button>
		</div>
	{/if}

	{#if editing}
		<div class="space-y-3">
			<label class="label">
				<span class="label-text">filename</span>
				<input class="input" bind:value={filename} />
			</label>
			<label class="label">
				<span class="label-text">body (markdown)</span>
				<textarea class="textarea font-mono" rows="18" bind:value={bodyMd}></textarea>
			</label>
			<div class="flex gap-2">
				<Button disabled={busy} onclick={save}>{busy ? 'Saving…' : 'Save'}</Button>
				<Button variant="tonal" type="button" onclick={() => (editing = false)}>Cancel</Button>
			</div>
		</div>
	{:else if doc.body_md}
		<Card>
			<pre class="whitespace-pre-wrap text-sm">{doc.body_md}</pre>
		</Card>
	{:else if doc.extracted_text}
		<section class="space-y-1">
			<h2 class="font-semibold opacity-80">Extracted text</h2>
			<Card><pre class="whitespace-pre-wrap text-sm">{doc.extracted_text}</pre></Card>
		</section>
	{:else}
		<p class="opacity-60">No inline content (binary stored at {doc.bucket}/{doc.key}).</p>
	{/if}
</div>
