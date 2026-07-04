<script lang="ts">
	/**
	 * TranscriptDrawer — slide-over showing an ENDED session's stored conversation
	 * (gtweb-b3fe6b). There is no live process behind a done/killed session, so the
	 * Terminal action renders this read-only history (GET /api/v1/agent/:id/transcript)
	 * instead of spawning a fresh agent from zero.
	 */
	import { browserOrch, type Transcript } from '$lib/api/orch';
	import { TrackerError } from '$lib/api/tracker';
	import { Badge } from '$lib/ui';

	interface Props {
		session: string;
		onclose: () => void;
	}
	let { session, onclose }: Props = $props();

	let transcript = $state<Transcript | null>(null);
	let error = $state('');
	let loading = $state(true);

	const client = browserOrch();

	$effect(() => {
		const s = session;
		loading = true;
		transcript = null;
		error = '';
		client
			.transcript(s)
			.then((t) => (transcript = t))
			.catch((e) => {
				error =
					e instanceof TrackerError && e.status === 404
						? 'Sin transcript almacenado para esta sesión.'
						: e instanceof TrackerError
							? e.message
							: String(e);
			})
			.finally(() => (loading = false));
	});

	function hhmm(at?: string): string {
		if (!at) return '';
		const d = new Date(at);
		return isNaN(d.getTime()) ? '' : d.toLocaleTimeString();
	}
</script>

<!-- Backdrop -->
<button
	class="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
	onclick={onclose}
	aria-label="Close transcript"
></button>

<!-- Drawer panel -->
<aside
	class="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col
		border-l border-[var(--gw-color-border-subtle)]
		bg-[var(--gw-color-surface)] shadow-2xl"
>
	<header
		class="flex items-center justify-between border-b border-[var(--gw-color-border-subtle)]
			px-[var(--gw-space-4)] py-[var(--gw-space-3)]"
	>
		<div>
			<h2 class="text-[var(--gw-text-sm)] font-semibold text-[var(--gw-color-text)]">
				Historial de sesión
			</h2>
			<p class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
				{session}
			</p>
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

	<div class="flex-1 overflow-y-auto px-[var(--gw-space-4)] py-[var(--gw-space-3)] space-y-[var(--gw-space-3)]">
		{#if loading}
			<p class="py-8 text-center text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">
				Cargando historial…
			</p>
		{:else if error}
			<p class="py-8 text-center text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">
				{error}
			</p>
		{:else if transcript}
			{#each transcript.turns as turn, i (i)}
				<div
					class="rounded-[var(--gw-radius-md)] border px-[var(--gw-space-3)] py-[var(--gw-space-2)]
						{turn.role === 'user'
						? 'border-[var(--gw-color-primary)]/30 bg-[var(--gw-color-primary)]/5'
						: 'border-[var(--gw-color-border-subtle)] bg-[var(--gw-color-surface-2)]'}"
				>
					<div class="mb-1 flex items-center justify-between gap-2">
						<span class="text-[10px] font-semibold uppercase tracking-wide
							{turn.role === 'user' ? 'text-[var(--gw-color-primary)]' : 'text-[var(--gw-color-text-muted)]'}">
							{turn.role === 'user' ? 'operador / sistema' : 'agente'}
						</span>
						{#if hhmm(turn.at)}
							<span class="font-[family-name:var(--gw-font-mono)] text-[10px] text-[var(--gw-color-text-muted)]">
								{hhmm(turn.at)}
							</span>
						{/if}
					</div>
					{#if turn.text}
						<p class="whitespace-pre-wrap break-words text-[var(--gw-text-sm)] text-[var(--gw-color-text)]">
							{turn.text}
						</p>
					{/if}
					{#if turn.tools?.length}
						<div class="mt-1 flex flex-wrap gap-1">
							{#each turn.tools as tool (tool)}
								<Badge variant="surface" class="font-[family-name:var(--gw-font-mono)] text-[10px]">{tool}</Badge>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	</div>
</aside>
