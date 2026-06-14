<script lang="ts">
	/**
	 * MessageDrawer — slide-over panel showing a session's A2A conversation
	 * (all messages involving the session, not just unread). The operator can
	 * send messages, read agent replies, and ack unread ones. Polls every 5s.
	 */
	import { browserA2a, type A2aMessage } from '$lib/api/orch';
	import { TrackerError } from '$lib/api/tracker';
	import { Button, Input } from '$lib/ui';

	interface Props {
		/** Session to show. null = all conversations in the workspace. */
		session: string | null;
		onclose: () => void;
	}
	let { session, onclose }: Props = $props();

	let messages = $state<A2aMessage[]>([]);
	let newMsg = $state('');
	let busy = $state(false);
	let error = $state('');

	const client = browserA2a();

	async function refresh() {
		try {
			messages = await client.threads(session ?? undefined, 100);
			error = '';
		} catch (e) {
			error = e instanceof TrackerError ? e.message : String(e);
		}
	}

	$effect(() => {
		const _s = session;
		refresh();
		const t = setInterval(refresh, 5_000);
		return () => clearInterval(t);
	});

	async function send() {
		if (!session) return; // can't send without a target
		const body = newMsg.trim();
		if (!body || busy) return;
		busy = true;
		error = '';
		try {
			await client.send(session, body);
			newMsg = '';
			await refresh();
		} catch (e) {
			error = e instanceof TrackerError ? e.message : String(e);
		} finally {
			busy = false;
		}
	}

	async function ack(id: string) {
		try {
			await client.ack(id);
			await refresh();
		} catch (e) {
			error = e instanceof TrackerError ? e.message : String(e);
		}
	}

	const title = $derived(session ? 'Buzón' : 'Todas las conversaciones');
</script>

<!-- Backdrop -->
<button
	class="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
	onclick={onclose}
	aria-label="Close messages"
></button>

<!-- Drawer panel -->
<aside
	class="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col
		border-l border-[var(--gw-color-border-subtle)]
		bg-[var(--gw-color-surface)] shadow-2xl"
>
	<!-- Header -->
	<header
		class="flex items-center justify-between border-b border-[var(--gw-color-border-subtle)]
			px-[var(--gw-space-4)] py-[var(--gw-space-3)]"
	>
		<div>
			<h2 class="text-[var(--gw-text-sm)] font-semibold text-[var(--gw-color-text)]">
				{title}
			</h2>
			{#if session}
				<p class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
					{session}
				</p>
			{/if}
		</div>
		<button
			class="rounded-[var(--gw-radius-md)] p-[var(--gw-space-1)] text-[var(--gw-color-text-muted)]
				hover:bg-[var(--gw-color-surface-3)] hover:text-[var(--gw-color-text)]"
			onclick={onclose}
			aria-label="Close"
		>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M18 6L6 18M6 6l12 12" />
			</svg>
		</button>
	</header>

	<!-- Messages list -->
	<div class="flex-1 overflow-y-auto px-[var(--gw-space-4)] py-[var(--gw-space-3)] space-y-[var(--gw-space-2)]">
		{#if error}
			<p class="text-[var(--gw-text-xs)] text-[var(--gw-color-error)]">{error}</p>
		{/if}

		{#if messages.length === 0}
			<p class="py-8 text-center text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">
				Sin mensajes.{#if session} Envía uno abajo.{/if}
			</p>
		{:else}
			{#each messages as m (m.id)}
				{@const isFromSession = session ? m.from === session : false}
				<div
					class="rounded-[var(--gw-radius-md)] border border-[var(--gw-color-border-subtle)] p-[var(--gw-space-3)]
						{isFromSession
							? 'ml-6 bg-[var(--gw-color-primary-subtle)]'
							: 'mr-6 bg-[var(--gw-color-surface-3)]'}"
				>
					<div class="mb-1 flex items-center justify-between gap-2">
						<span class="flex items-center gap-1 font-[family-name:var(--gw-font-mono)] text-[10px] font-medium text-[var(--gw-color-text-muted)]">
							{m.from}
							<span class="text-[var(--gw-color-text-muted)] opacity-50">&rarr;</span>
							{m.to ?? '?'}
						</span>
						<span class="flex items-center gap-1">
							{#if m.acked}
								<span class="text-[9px] text-[var(--gw-color-success)]" title="Leído">&check;</span>
							{/if}
							<span class="font-[family-name:var(--gw-font-mono)] text-[9px] text-[var(--gw-color-text-muted)]">
								{m.id}
							</span>
						</span>
					</div>
					<p class="whitespace-pre-wrap text-[var(--gw-text-sm)] text-[var(--gw-color-text)]">
						{m.body}
					</p>
					{#if m.in_reply_to}
						<p class="mt-1 text-[10px] text-[var(--gw-color-text-muted)]">
							&larr; {m.in_reply_to}
						</p>
					{/if}
					{#if !m.acked && !isFromSession}
						<button
							class="mt-1 text-[10px] text-[var(--gw-color-primary)] hover:underline"
							onclick={() => ack(m.id)}
						>Marcar leído</button>
					{/if}
				</div>
			{/each}
		{/if}
	</div>

	<!-- Compose form (only when a session is targeted) -->
	{#if session}
		<form
			class="flex items-center gap-[var(--gw-space-2)] border-t border-[var(--gw-color-border-subtle)]
				px-[var(--gw-space-4)] py-[var(--gw-space-3)]"
			onsubmit={(e) => { e.preventDefault(); send(); }}
		>
			<Input
				class="min-w-0 flex-1"
				placeholder="Mensaje para {session}…"
				bind:value={newMsg}
				disabled={busy}
			/>
			<Button type="submit" disabled={busy || !newMsg.trim()}>Enviar</Button>
		</form>
	{/if}
</aside>
