<script lang="ts">
	import { onMount } from 'svelte';
	import { hasScope } from '$lib/api/auth';
	import { TrackerError } from '$lib/api/tracker';
	import { browserHooks, EVENT_TYPES, type Hook } from '$lib/api/hooks';
	import { browserAdmin, type Rig, type Workspace } from '$lib/api/admin';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const canWrite = $derived(hasScope(data.user?.scopes, 'hooks.write'));

	const ROLES = ['mayor', 'polecat', 'witness', 'refinery', 'deacon', 'overseer', 'sheriff', 'dog'];

	let list = $state<Hook[]>([]);
	let loading = $state(true);
	let error = $state('');
	let busy = $state(false);

	let workspaces = $state<Workspace[]>([]);
	let rigs = $state<Rig[]>([]);

	let form = $state({
		event: 'PreToolUse' as string,
		matcher: '',
		command: '',
		workspaces: [] as string[],
		rigs: [] as string[],
		roles: [] as string[]
	});

	async function refresh() {
		loading = true;
		error = '';
		try {
			list = await browserHooks().list();
		} catch (err) {
			error = err instanceof TrackerError ? `${err.status}: ${err.message}` : String(err);
		} finally {
			loading = false;
		}
	}

	async function loadTargets() {
		try {
			workspaces = await browserAdmin().workspaces();
		} catch {
			workspaces = [];
		}
		try {
			rigs = await browserAdmin().rigs();
		} catch {
			rigs = [];
		}
	}

	onMount(() => {
		refresh();
		if (canWrite) loadTargets();
	});

	async function run(fn: () => Promise<unknown>) {
		error = '';
		busy = true;
		try {
			await fn();
			await refresh();
		} catch (err) {
			error = err instanceof TrackerError ? `${err.status}: ${err.message}` : String(err);
		} finally {
			busy = false;
		}
	}

	async function register(e: SubmitEvent) {
		e.preventDefault();
		await run(async () => {
			await browserHooks().register({
				event: form.event,
				matcher: form.matcher.trim(),
				command: form.command,
				target: {
					workspaces: [...form.workspaces],
					rigs: [...form.rigs],
					roles: [...form.roles]
				}
			});
			form.matcher = '';
			form.command = '';
			form.workspaces = [];
			form.rigs = [];
			form.roles = [];
		});
	}

	const retire = (id: string) => run(() => browserHooks().retire(id));

	const byEvent = $derived.by(() => {
		const m = new Map<string, Hook[]>();
		for (const h of list) {
			if (!m.has(h.event)) m.set(h.event, []);
			m.get(h.event)!.push(h);
		}
		return m;
	});

	const dim = (xs: string[]) => (xs.length === 0 ? 'all' : xs.join(', '));
</script>

<!-- Mechanical noise substrate -->
<svg style="display:none" aria-hidden="true">
	<filter id="hk-noise">
		<feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
		<feColorMatrix type="saturate" values="0" />
		<feBlend in="SourceGraphic" mode="multiply" />
	</filter>
</svg>
<svg
	style="position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999;opacity:0.04;"
	xmlns="http://www.w3.org/2000/svg"
	aria-hidden="true"
>
	<rect width="100%" height="100%" filter="url(#hk-noise)" />
</svg>

<div class="brutal-root">

	<!-- Page header -->
	<header style="margin-bottom:3rem;">
		<div class="mono" style="margin-bottom:0.75rem;opacity:0.45;">[ CLAUDE CODE / HOOKS / REV 1.0 ]</div>
		<h1 class="heading">HOOKS</h1>
		<div style="border-top:4px solid #E61919;margin-top:1.25rem;margin-bottom:1.25rem;"></div>
		<p class="mono" style="text-transform:none;font-size:12px;line-height:1.7;max-width:58ch;opacity:0.6;">
			Global Claude Code hooks. Each is materialised into a session's
			<code style="background:#0D0D0D;color:#F4F4F0;padding:0 4px;font-size:11px;"
				>.claude/settings.json</code
			>
			when its target matches the session's workspace / rig / role. Empty selection = all.
		</p>
	</header>

	<!-- Error banner -->
	{#if error}
		<div class="error-bar" style="margin-bottom:2rem;">
			<span class="mono" style="color:#E61919;white-space:nowrap;">! ERR</span>
			<span class="mono" style="color:#E61919;font-size:12px;text-transform:none;">{error}</span>
		</div>
	{/if}

	<!-- New hook form -->
	{#if canWrite}
		<section style="border:1px solid #0D0D0D;margin-bottom:3rem;">
			<div class="section-header">
				<span class="mono" style="color:#F4F4F0;">[ NEW HOOK ]</span>
				<span class="mono" style="color:#F4F4F0;opacity:0.4;margin-left:auto;font-size:10px;"
					>ID GENERATED AUTOMATICALLY</span
				>
			</div>

			<form style="padding:1.5rem;display:flex;flex-direction:column;gap:1.5rem;" onsubmit={register}>

				<!-- Event + Matcher -->
				<div class="grid-1px" style="grid-template-columns:1fr 1fr;">
					<div class="cell">
						<div class="mono" style="margin-bottom:0.5rem;font-size:10px;opacity:0.45;">EVENT</div>
						<select class="brutal-select" bind:value={form.event}>
							{#each EVENT_TYPES as ev (ev)}
								<option value={ev}>{ev}</option>
							{/each}
						</select>
					</div>
					<div class="cell">
						<div class="mono" style="margin-bottom:0.5rem;font-size:10px;opacity:0.45;">
							MATCHER · EMPTY = ALL
						</div>
						<input class="brutal-input" bind:value={form.matcher} placeholder="Bash(rm -rf /*)" />
					</div>
				</div>

				<!-- Command -->
				<div>
					<div class="mono" style="margin-bottom:0.5rem;font-size:10px;opacity:0.45;">COMMAND</div>
					<input
						class="brutal-input"
						bind:value={form.command}
						placeholder="echo 'BLOCKED' && exit 2"
						required
					/>
				</div>

				<!-- Target scope -->
				<fieldset style="border:1px solid #0D0D0D;padding:0;margin:0;">
					<div class="section-header" style="padding:0.5rem 1rem;">
						<span class="mono" style="color:#F4F4F0;font-size:10px;"
							>TARGET SCOPE · EMPTY = APPLIES EVERYWHERE</span
						>
					</div>
					<div class="grid-1px" style="grid-template-columns:1fr 1fr 1fr;">
						<div class="cell">
							<div class="mono" style="margin-bottom:0.5rem;font-size:10px;opacity:0.45;">
								WORKSPACES
							</div>
							<select
								class="brutal-select"
								multiple
								size={Math.min(6, Math.max(3, workspaces.length))}
								bind:value={form.workspaces}
							>
								{#each workspaces as ws (ws.id)}
									<option value={ws.id}>{ws.name || ws.id}</option>
								{/each}
							</select>
						</div>
						<div class="cell">
							<div class="mono" style="margin-bottom:0.5rem;font-size:10px;opacity:0.45;">
								RIGS · CURRENT WS
							</div>
							<select
								class="brutal-select"
								multiple
								size={Math.min(6, Math.max(3, rigs.length))}
								bind:value={form.rigs}
							>
								{#each rigs as r (r.name)}
									<option value={r.name}>{r.name}</option>
								{/each}
							</select>
						</div>
						<div class="cell">
							<div class="mono" style="margin-bottom:0.5rem;font-size:10px;opacity:0.45;">ROLES</div>
							<select class="brutal-select" multiple size={6} bind:value={form.roles}>
								{#each ROLES as role (role)}
									<option value={role}>{role}</option>
								{/each}
							</select>
						</div>
					</div>
					<div
						class="mono"
						style="padding:0.5rem 1rem;font-size:10px;opacity:0.35;border-top:1px solid #0D0D0D;"
					>
						CTRL / CMD-CLICK TO SELECT MULTIPLE
					</div>
				</fieldset>

				<!-- Submit -->
				<div
					style="display:flex;justify-content:flex-end;border-top:1px solid #0D0D0D;padding-top:1.25rem;"
				>
					<button class="brutal-btn" type="submit" disabled={busy || !form.command.trim()}>
						{busy ? '>>> REGISTERING…' : '>>> REGISTER HOOK'}
					</button>
				</div>
			</form>
		</section>
	{/if}

	<!-- Hook list -->
	{#if loading}
		<div class="mono" style="opacity:0.5;display:flex;gap:0.75rem;align-items:center;">
			<span class="spin">⟳</span>
			LOADING HOOKS…
		</div>
	{:else if list.length === 0}
		<div
			style="border:1px solid #0D0D0D;padding:5rem 2rem;display:flex;flex-direction:column;align-items:center;gap:1rem;opacity:0.35;"
		>
			<span style="font-size:2.5rem;line-height:1;">⌖</span>
			<span class="mono">NO HOOKS REGISTERED</span>
		</div>
	{:else}
		<div style="display:flex;flex-direction:column;gap:2rem;">
			{#each [...byEvent] as [event, hooks] (event)}
				<section style="border:1px solid #0D0D0D;">
					<div class="section-header">
						<span class="mono" style="color:#E61919;">[ {event} ]</span>
						<span class="mono" style="color:#F4F4F0;opacity:0.45;font-size:10px;margin-left:auto;">
							{hooks.length} HOOK{hooks.length !== 1 ? 'S' : ''}
						</span>
					</div>

					<div class="grid-1px">
						{#each hooks as h (h.id)}
							<div class="cell" style="display:flex;align-items:flex-start;gap:1.5rem;">
								<div
									style="min-width:0;flex:1;display:flex;flex-direction:column;gap:0.5rem;"
								>
									<!-- ID + matcher -->
									<div
										style="display:flex;flex-wrap:wrap;align-items:center;gap:0.625rem;"
									>
										<code class="mono" style="font-size:10px;opacity:0.45;"
											>&lt; {h.id} &gt;</code
										>
										{#if h.matcher}
											<span class="matcher-tag">{h.matcher}</span>
										{:else}
											<span
												class="mono"
												style="font-size:10px;opacity:0.3;text-transform:none;font-style:italic;"
												>all invocations</span
											>
										{/if}
									</div>

									<!-- Command -->
									<div class="cmd-display" title={h.command}>{h.command}</div>

									<!-- Target summary -->
									<div style="display:flex;flex-wrap:wrap;gap:1.5rem;">
										<span class="mono" style="font-size:10px;opacity:0.45;"
											>WS: {dim(h.target.workspaces)}</span
										>
										<span class="mono" style="font-size:10px;opacity:0.45;"
											>RIG: {dim(h.target.rigs)}</span
										>
										<span class="mono" style="font-size:10px;opacity:0.45;"
											>ROLE: {dim(h.target.roles)}</span
										>
									</div>
								</div>

								{#if canWrite}
									<button
										type="button"
										disabled={busy}
										onclick={() => retire(h.id)}
										class="retire-btn"
									>
										RETIRE
									</button>
								{/if}
							</div>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	{/if}

</div>

<style>
	.brutal-root {
		background: #f4f4f0;
		color: #0d0d0d;
		padding: 2.5rem;
		min-height: 100%;
	}

	.heading {
		font-family: 'Archivo Black', 'Inter', sans-serif;
		font-weight: 900;
		font-size: clamp(3rem, 8vw, 10rem);
		letter-spacing: -0.05em;
		line-height: 0.88;
		text-transform: uppercase;
		color: #0d0d0d;
		margin: 0;
	}

	.mono {
		font-family: 'JetBrains Mono', 'IBM Plex Mono', 'Courier New', monospace;
		font-size: 11px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.grid-1px {
		display: grid;
		gap: 1px;
		background: #0d0d0d;
	}

	.cell {
		background: #f4f4f0;
		padding: 1rem;
	}

	.section-header {
		background: #0d0d0d;
		color: #f4f4f0;
		padding: 0.625rem 1rem;
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.brutal-btn {
		border: 1px solid #0d0d0d;
		background: #0d0d0d;
		color: #f4f4f0;
		font-family: 'JetBrains Mono', 'IBM Plex Mono', monospace;
		font-size: 11px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 0.5rem 1.25rem;
		cursor: pointer;
		border-radius: 0;
	}

	.brutal-btn:hover:not(:disabled) {
		background: #e61919;
		border-color: #e61919;
	}

	.brutal-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.retire-btn {
		border: 1px solid #e61919;
		background: transparent;
		color: #e61919;
		font-family: 'JetBrains Mono', 'IBM Plex Mono', monospace;
		font-size: 11px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 0.375rem 0.75rem;
		cursor: pointer;
		border-radius: 0;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.retire-btn:hover:not(:disabled) {
		background: #e61919;
		color: #f4f4f0;
	}

	.retire-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.brutal-input {
		border: 1px solid #0d0d0d;
		background: #f4f4f0;
		color: #0d0d0d;
		font-family: 'JetBrains Mono', 'IBM Plex Mono', monospace;
		font-size: 12px;
		padding: 0.5rem 0.625rem;
		width: 100%;
		border-radius: 0;
		outline: none;
		display: block;
	}

	.brutal-input:focus {
		outline: 2px solid #e61919;
		outline-offset: -1px;
	}

	.brutal-select {
		border: 1px solid #0d0d0d;
		background: #f4f4f0;
		color: #0d0d0d;
		font-family: 'JetBrains Mono', 'IBM Plex Mono', monospace;
		font-size: 11px;
		text-transform: uppercase;
		padding: 0.375rem;
		width: 100%;
		border-radius: 0;
		outline: none;
		display: block;
	}

	.brutal-select:focus {
		outline: 2px solid #e61919;
		outline-offset: -1px;
	}

	.cmd-display {
		background: #0d0d0d;
		color: #f4f4f0;
		padding: 0.5rem 0.75rem;
		font-family: 'JetBrains Mono', 'IBM Plex Mono', monospace;
		font-size: 11px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.error-bar {
		border: 2px solid #e61919;
		padding: 0.875rem 1rem;
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	.matcher-tag {
		border: 1px solid #0d0d0d;
		padding: 1px 6px;
		font-family: 'JetBrains Mono', 'IBM Plex Mono', monospace;
		font-size: 11px;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.spin {
		display: inline-block;
		animation: spin 2s linear infinite;
	}
</style>
