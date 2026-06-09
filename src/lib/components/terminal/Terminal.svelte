<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Terminal } from '@xterm/xterm';
	import { FitAddon } from '@xterm/addon-fit';
	import '@xterm/xterm/css/xterm.css';

	const WS_PATH = '/api/v1/terminal/ws';

	interface Props {
		// Attach to an agent's tmux session (read-only) instead of a fresh shell.
		session?: string;
		// Interactive attach-or-create (hq-session-terminal.2).
		write?: boolean;
		// Fill parent height instead of the standalone-page default `70vh` (hq-term-dock.3).
		fill?: boolean;
	}
	let { session, write = false, fill = false }: Props = $props();

	let host = $state<HTMLDivElement>();
	let status = $state<'connecting' | 'open' | 'closed' | 'error'>('connecting');
	let detail = $state('');

	let term: Terminal | undefined;
	let fit: FitAddon | undefined;
	let ws: WebSocket | undefined;
	let ro: ResizeObserver | undefined;
	const enc = new TextEncoder();

	const statusColor: Record<typeof status, string> = {
		connecting: 'var(--gw-color-warning)',
		open:       'var(--gw-color-success)',
		closed:     'var(--gw-color-text-muted)',
		error:      'var(--gw-color-error)'
	};

	function sendResize() {
		if (!fit || !term || ws?.readyState !== WebSocket.OPEN) return;
		fit.fit();
		ws.send(JSON.stringify({ resize: { cols: term.cols, rows: term.rows } }));
	}

	function connect() {
		const proto = location.protocol === 'https:' ? 'wss' : 'ws';
		const params = new URLSearchParams();
		if (session) params.set('session', session);
		if (write) params.set('write', '1');
		const qs = params.toString() ? `?${params}` : '';
		ws = new WebSocket(`${proto}://${location.host}${WS_PATH}${qs}`);
		ws.binaryType = 'arraybuffer';

		ws.onopen = () => { status = 'open'; detail = ''; sendResize(); term?.focus(); };
		ws.onmessage = (e) => {
			if (typeof e.data === 'string') term?.write(e.data);
			else term?.write(new Uint8Array(e.data));
		};
		ws.onerror = () => { status = 'error'; detail = 'connection error'; };
		ws.onclose = (e) => {
			status = 'closed';
			detail = e.code === 1008
				? 'rejected: missing terminal.exec scope'
				: e.reason || `closed (code ${e.code})`;
		};
	}

	onMount(() => {
		term = new Terminal({
			fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
			fontSize: 13,
			cursorBlink: true,
			theme: { background: '#0b0f17' }
		});
		fit = new FitAddon();
		term.loadAddon(fit);
		term.open(host!);
		fit.fit();
		term.onData((d) => { if (ws?.readyState === WebSocket.OPEN) ws.send(enc.encode(d)); });
		ro = new ResizeObserver(() => sendResize());
		ro.observe(host!);
		connect();
	});

	onDestroy(() => { ro?.disconnect(); ws?.close(); term?.dispose(); });

	function reconnect() { ws?.close(); status = 'connecting'; detail = ''; connect(); }
</script>

<div class="flex flex-col gap-2.5" class:h-full={fill}>

	<!-- ── Status bar ─────────────────────────────────────────────────────────── -->
	<div class="flex shrink-0 items-center gap-2.5">
		<!-- Status dot -->
		<span
			class="h-2 w-2 shrink-0 rounded-full"
			class:animate-pulse={status === 'connecting'}
			style="background-color: {statusColor[status]}"
		></span>
		<span class="text-xs text-[var(--gw-color-text-muted)]">
			{status}{detail ? ` — ${detail}` : ''}
		</span>
		{#if status === 'closed' || status === 'error'}
			<button
				type="button"
				onclick={reconnect}
				class="rounded-full border border-[var(--gw-color-border)] px-3 py-0.5 text-xs font-medium text-[var(--gw-color-text-muted)]
					transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
					hover:border-[var(--gw-color-primary)] hover:text-[var(--gw-color-primary)]
					focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gw-color-primary-focus)]"
			>
				Reconnect
			</button>
		{/if}
	</div>

	<!-- ── Terminal pane ──────────────────────────────────────────────────────── -->
	{#if fill}
		<!-- Dock mode: fill parent, no decorative frame -->
		<div
			bind:this={host}
			class="min-h-0 flex-1 w-full p-2"
			style="background:#0b0f17"
		></div>
	{:else}
		<!-- Standalone page: Double-Bezel dark frame -->
		<div class="rounded-2xl border border-[var(--gw-color-border)]/60 bg-[var(--gw-color-border)]/10 p-0.5 h-[70vh]">
			<div
				class="h-full overflow-hidden rounded-[calc(1.25rem-2px)]"
				style="background:#0b0f17; box-shadow: inset 0 1px 1px rgba(255,255,255,0.04)"
			>
				<div bind:this={host} class="h-full w-full p-2" style="background:#0b0f17"></div>
			</div>
		</div>
	{/if}

</div>
