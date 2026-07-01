<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { base } from '$app/paths';
	import { browserDocs } from '$lib/api/documents';
	import { TrackerError } from '$lib/api/tracker';
	import { hasScope } from '$lib/api/auth';
	import { Badge, Button } from '$lib/ui';
	import { Markdown } from '$lib/components/ui';
	import BlockEditor from '$lib/components/knowledge/BlockEditor.svelte';
	import CommentThread from '$lib/components/CommentThread.svelte';
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
			await goto(`${base}/knowledge`);
		} catch (err) {
			error = err instanceof TrackerError ? `${err.status}: ${err.message}` : String(err);
			busy = false;
		}
	}

	// --- shares ---
	let shareTtlDays = $state(7);
	let copied = $state('');

	const DAY = 86400;
	async function shareRun(fn: () => Promise<unknown>) {
		busy = true;
		error = '';
		try {
			await fn();
			await invalidateAll();
		} catch (err) {
			error = err instanceof TrackerError ? `${err.status}: ${err.message}` : String(err);
		} finally {
			busy = false;
		}
	}

	function createShare() {
		const expires_in = shareTtlDays > 0 ? shareTtlDays * DAY : undefined;
		return shareRun(() => browserDocs().createShare(doc.id, { expires_in, created_by: data.user?.sub }));
	}
	const extendShare = (hash: string) => shareRun(() => browserDocs().patchShare(hash, { expires_in: 7 * DAY }));
	const liftShare = (hash: string) => shareRun(() => browserDocs().patchShare(hash, {}));
	const revokeShare = (hash: string) => shareRun(() => browserDocs().revokeShare(hash));

	async function copyUrl(url: string) {
		try {
			await navigator.clipboard.writeText(location.origin + url);
			copied = url;
			setTimeout(() => (copied = ''), 1500);
		} catch {
			/* clipboard blocked; ignore */
		}
	}

	const shareVariant = (s: string) =>
		s === 'active' ? 'success' : s === 'expired' ? 'warning' : 'error';

	// ── hq-3ed2c3: export, file attach, live updates ─────────────────────────

	/** Download/export the markdown body (MANDATORY md export). */
	function downloadMd() {
		const blob = new Blob([doc.body_md ?? doc.extracted_text ?? ''], {
			type: 'text/markdown'
		});
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = doc.filename.endsWith('.md') ? doc.filename : `${doc.filename}.md`;
		a.click();
		URL.revokeObjectURL(a.href);
	}

	/** Attach a binary file to this document's owner (bytes land in store.blob). */
	async function attachFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		busy = true;
		error = '';
		try {
			const buf = new Uint8Array(await file.arrayBuffer());
			let bin = '';
			for (let i = 0; i < buf.length; i += 0x8000)
				bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
			await browserDocs().attach({
				owner_type: doc.owner_type,
				owner_id: doc.owner_id,
				kind: 'blob',
				filename: file.name,
				content_type: file.type || 'application/octet-stream',
				data_base64: btoa(bin),
				created_by: data.user?.sub ?? 'gt-web'
			});
			await invalidateAll();
		} catch (err) {
			error = err instanceof TrackerError ? `${err.status}: ${err.message}` : String(err);
		} finally {
			busy = false;
			input.value = '';
		}
	}

	// Live collaboration (hq-0c8fe1): the doc:{id} SSE topic pushes block edits
	// and comments from other clients; debounce into a reload. Conflict policy
	// is last-write-wins per block (ADR) — the editor splices into fresh state.
	$effect(() => {
		const es = new EventSource(`/stream?topic=${encodeURIComponent(`doc:${doc.id}`)}`, {
			withCredentials: true
		});
		let timer: ReturnType<typeof setTimeout> | null = null;
		const refresh = () => {
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => invalidateAll(), 400);
		};
		for (const k of [
			'documents.updated.v1',
			'documents.attached.v1',
			'documents.removed.v1',
			'comments.created.v1',
			'comments.updated.v1',
			'comments.deleted.v1'
		])
			es.addEventListener(k, refresh as EventListener);
		return () => {
			es.close();
			if (timer) clearTimeout(timer);
		};
	});
</script>

<style>
	@keyframes fade-up-in {
		from { opacity: 0; transform: translateY(8px); }
		to   { opacity: 1; transform: translateY(0); }
	}

	.entry   { animation: fade-up-in 480ms cubic-bezier(0.32, 0.72, 0, 1) both; }
	.entry-1 { animation-delay: 0ms; }
	.entry-2 { animation-delay: 60ms; }
	.entry-3 { animation-delay: 120ms; }
	.entry-4 { animation-delay: 180ms; }

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

	/* Share row hover */
	.share-row {
		transition: background-color 160ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.share-row:hover {
		background-color: var(--gw-color-surface-3);
	}
</style>

<div class="mx-auto max-w-3xl space-y-5">

	<!-- ── Back nav ───────────────────────────────────────────────────── -->
	<a
		href="{base}/knowledge"
		class="entry entry-1 inline-flex items-center gap-1.5 rounded-full
			border border-[var(--gw-color-border-subtle)]
			bg-[var(--gw-color-surface-3)]
			px-[var(--gw-space-3)] py-[var(--gw-space-1)]
			text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]
			transition-colors duration-[200ms] ease-[cubic-bezier(0.32,0.72,0,1)]
			hover:text-[var(--gw-color-text)]"
	>← Knowledge</a>

	<!-- ── Document header ────────────────────────────────────────────── -->
	<header class="entry entry-2 space-y-2">
		<span
			class="inline-flex items-center rounded-full border border-[var(--gw-color-border-subtle)]
				bg-[var(--gw-color-surface-3)] px-[var(--gw-space-3)] py-[3px]
				text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--gw-color-text-muted)]"
		>Document</span>
		<div class="flex flex-wrap items-start gap-3">
			<h1
				class="text-[var(--gw-text-3xl)] font-semibold leading-[var(--gw-leading-tight)]
					tracking-tight text-[var(--gw-color-text)]"
			>{doc.filename}</h1>
			<div class="flex items-center gap-2 pt-1">
				<Badge variant="surface">{doc.kind}</Badge>
				<Badge variant="primary">v{doc.version}</Badge>
			</div>
		</div>
		<div class="flex flex-wrap gap-x-[var(--gw-space-4)] gap-y-[var(--gw-space-1)]
			text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
			<span>{doc.owner_type}:{doc.owner_id}</span>
			{#if doc.content_type}<span>{doc.content_type}</span>{/if}
			{#if doc.uploaded_by}<span>by {doc.uploaded_by}</span>{/if}
			<span>{new Date(doc.uploaded_at).toLocaleString()}</span>
		</div>
	</header>

	{#if error}
		<p class="text-[var(--gw-text-sm)] text-[var(--gw-color-error)]">{error}</p>
	{/if}

	{#if !editing}
		<div class="entry entry-3 flex flex-wrap items-center gap-[var(--gw-space-2)]">
			{#if canWrite}
				<Button variant="tonal" onclick={startEdit}>Edit (raw)</Button>
				<Button variant="tonal" disabled={busy} onclick={remove}>Delete</Button>
			{/if}
			<Button variant="tonal" onclick={downloadMd}>Descargar .md</Button>
			{#if canWrite}
				<label class="cursor-pointer rounded-full border border-[var(--gw-color-border-subtle)] px-3 py-1 text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)] hover:text-[var(--gw-color-text)]">
					Adjuntar archivo
					<input type="file" class="hidden" onchange={attachFile} disabled={busy} />
				</label>
			{/if}
		</div>
	{/if}

	{#if editing}
		<!-- Edit form — Double-Bezel -->
		<div class="entry entry-3 bezel">
			<div class="bezel-core space-y-[var(--gw-space-3)] p-[var(--gw-space-4)]">
				<label class="block space-y-1 text-[var(--gw-text-xs)]">
					<span class="text-[var(--gw-color-text-muted)]">filename</span>
					<input class="input w-full" bind:value={filename} />
				</label>
				<label class="block space-y-1 text-[var(--gw-text-xs)]">
					<span class="text-[var(--gw-color-text-muted)]">body (markdown)</span>
					<textarea
						class="textarea font-[family-name:var(--gw-font-mono)]"
						rows="18"
						bind:value={bodyMd}
					></textarea>
				</label>
				<div class="flex gap-[var(--gw-space-2)]">
					<Button disabled={busy} onclick={save}>{busy ? 'Saving…' : 'Save'}</Button>
					<Button variant="tonal" type="button" onclick={() => (editing = false)}>Cancel</Button>
				</div>
			</div>
		</div>

	{:else if doc.body_md !== null && doc.body_md !== undefined}
		<!-- Block editor (hq-3ed2c3): double-click a block to edit; LWW per block -->
		<div class="entry entry-3 bezel">
			<div class="bezel-core p-[var(--gw-space-4)]">
				<BlockEditor {doc} editedBy={data.user?.sub ?? 'gt-web'} {canWrite} />
			</div>
		</div>

	{:else if doc.extracted_text}
		<!-- Extracted text — Double-Bezel -->
		<div class="entry entry-3 space-y-[var(--gw-space-2)]">
			<p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--gw-color-text-muted)]">
				Extracted text
			</p>
			<div class="bezel">
				<div class="bezel-core p-[var(--gw-space-4)]">
					<Markdown text={doc.extracted_text} />
				</div>
			</div>
		</div>

	{:else}
		<p class="entry entry-3 text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">
			No inline content (binary stored at {doc.bucket}/{doc.key}).
		</p>
	{/if}

	{#if canWrite}
		<!-- Shares section — Double-Bezel -->
		<section class="entry entry-4 bezel">
			<div class="bezel-core">
				<!-- Section header -->
				<header
					class="flex flex-wrap items-center justify-between gap-[var(--gw-space-3)]
						border-b border-[var(--gw-color-border-subtle)]
						px-[var(--gw-space-4)] py-[var(--gw-space-3)]"
				>
					<h2 class="text-[var(--gw-text-sm)] font-semibold text-[var(--gw-color-text)]">
						Shares
					</h2>
					<div class="flex items-end gap-[var(--gw-space-2)]">
						<label class="space-y-1 text-[var(--gw-text-xs)]">
							<span class="text-[var(--gw-color-text-muted)]">TTL days (0 = no limit)</span>
							<input class="input w-28" type="number" min="0" bind:value={shareTtlDays} />
						</label>
						<Button disabled={busy} onclick={createShare}>Create share</Button>
					</div>
				</header>

				{#if data.shares.length === 0}
					<p class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]
						text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">
						No shares for this document.
					</p>
				{:else}
					<table class="table">
						<thead>
							<tr><th>Link</th><th>State</th><th>Expires</th><th></th></tr>
						</thead>
						<tbody>
							{#each data.shares as sh (sh.hash)}
								<tr class="share-row">
									<td>
										<button
											class="font-[family-name:var(--gw-font-mono)] text-xs
												text-[var(--gw-color-text-muted)]
												transition-colors duration-[150ms] hover:text-[var(--gw-color-text)] hover:underline"
											onclick={() => copyUrl(sh.url)}
										>
											{sh.url}{copied === sh.url ? ' ✓ copied' : ''}
										</button>
									</td>
									<td><Badge variant={shareVariant(sh.state)}>{sh.state}</Badge></td>
									<td class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
										{sh.expires_at ? new Date(sh.expires_at).toLocaleString() : '—'}
									</td>
									<td class="text-right">
										{#if sh.state !== 'revoked'}
											<Button variant="tonal" disabled={busy} onclick={() => extendShare(sh.hash)}>+7d</Button>
											<Button variant="tonal" disabled={busy} onclick={() => liftShare(sh.hash)}>No limit</Button>
											<Button variant="tonal" disabled={busy} onclick={() => revokeShare(sh.hash)}>Revoke</Button>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</div>
		</section>
	{/if}


	<!-- Comments (hq-57042e, target kind=doc) -->
	<section class="entry entry-4 bezel">
		<div class="bezel-core p-[var(--gw-space-4)]">
			<CommentThread targetKind="doc" targetId={doc.id} />
		</div>
	</section>

</div>
