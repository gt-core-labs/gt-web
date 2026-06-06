<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Terminal } from '@xterm/xterm';
	import { FitAddon } from '@xterm/addon-fit';
	import '@xterm/xterm/css/xterm.css';

	// Backend WS that spawns /bin/sh on a pty (hq-terminal). Same-origin so the gt_web_token
	// cookie rides automatically; Traefik routes /api to the backend and upgrades the socket.
	const WS_PATH = '/api/v1/terminal/ws';

	let host = $state<HTMLDivElement>();
	let status = $state<'connecting' | 'open' | 'closed' | 'error'>('connecting');
	let detail = $state('');

	let term: Terminal | undefined;
	let fit: FitAddon | undefined;
	let ws: WebSocket | undefined;
	let ro: ResizeObserver | undefined;
	const enc = new TextEncoder();

	function sendResize() {
		if (!fit || !term || ws?.readyState !== WebSocket.OPEN) return;
		fit.fit();
		ws.send(JSON.stringify({ resize: { cols: term.cols, rows: term.rows } }));
	}

	function connect() {
		const proto = location.protocol === 'https:' ? 'wss' : 'ws';
		ws = new WebSocket(`${proto}://${location.host}${WS_PATH}`);
		ws.binaryType = 'arraybuffer';

		ws.onopen = () => {
			status = 'open';
			detail = '';
			sendResize();
			term?.focus();
		};
		ws.onmessage = (e) => {
			if (typeof e.data === 'string') term?.write(e.data);
			else term?.write(new Uint8Array(e.data));
		};
		ws.onerror = () => {
			status = 'error';
			detail = 'connection error';
		};
		ws.onclose = (e) => {
			status = 'closed';
			// 1008 = policy (no scope); 1006 = abnormal (often auth before upgrade).
			detail =
				e.code === 1008
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

		// Keystrokes → pty (xterm emits both text and pasted bytes via onData).
		term.onData((d) => {
			if (ws?.readyState === WebSocket.OPEN) ws.send(enc.encode(d));
		});

		ro = new ResizeObserver(() => sendResize());
		ro.observe(host!);

		connect();
	});

	onDestroy(() => {
		ro?.disconnect();
		ws?.close();
		term?.dispose();
	});

	function reconnect() {
		ws?.close();
		status = 'connecting';
		detail = '';
		connect();
	}
</script>

<div class="flex flex-col gap-2">
	<div class="flex items-center gap-3 text-sm">
		<span
			class="inline-block h-2 w-2 rounded-full"
			class:bg-success-500={status === 'open'}
			class:bg-warning-500={status === 'connecting'}
			class:bg-error-500={status === 'closed' || status === 'error'}
		></span>
		<span class="opacity-70">{status}{detail ? ` — ${detail}` : ''}</span>
		{#if status === 'closed' || status === 'error'}
			<button class="btn btn-sm preset-tonal" onclick={reconnect}>Reconnect</button>
		{/if}
	</div>
	<div bind:this={host} class="h-[70vh] w-full rounded border border-surface-500/20 p-2" style="background:#0b0f17"></div>
</div>
