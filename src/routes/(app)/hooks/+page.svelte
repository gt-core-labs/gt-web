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

	// Scroll-reveal Svelte action — adds .is-revealed when the element enters the viewport.
	function reveal(node: HTMLElement, delayMs = 0) {
		node.style.setProperty('--reveal-delay', `${delayMs}ms`);
		const io = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					node.classList.add('is-revealed');
					io.disconnect();
				}
			},
			{ threshold: 0.06 }
		);
		io.observe(node);
		return { destroy: () => io.disconnect() };
	}
</script>

<!-- ─── Page ────────────────────────────────────────────────────────────────── -->
<div class="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:px-10 md:py-20 xl:max-w-7xl xl:px-12 2xl:max-w-screen-xl min-h-[100dvh]">

	<!-- ── Header ─────────────────────────────────────────────────────────────── -->
	<header class="reveal-entry mb-16 flex flex-col gap-4" use:reveal>
		<span class="w-fit rounded-full border border-[var(--gw-color-border)] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--gw-color-text-muted)]">
			Global Registry
		</span>
		<div class="flex flex-col gap-3">
			<h1 class="text-5xl font-bold tracking-tight leading-none text-[var(--gw-color-text)] sm:text-6xl">
				Hooks
			</h1>
			<p class="max-w-2xl text-sm leading-relaxed text-[var(--gw-color-text-muted)]">
				Global Claude Code hooks. Each is materialised into a session's
				<code class="inline-flex items-center rounded-md bg-[var(--gw-color-surface-3)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--gw-color-text)]">.claude/settings.json</code>
				when its target matches the session's workspace · rig · role. An empty selection equals all.
			</p>
		</div>
	</header>

	<!-- ── Error ──────────────────────────────────────────────────────────────── -->
	{#if error}
		<div class="reveal-entry mb-8" use:reveal>
			<div class="rounded-2xl border border-[var(--color-error-500)]/30 bg-[var(--color-error-500)]/8 px-4 py-3 font-mono text-sm text-[var(--color-error-500)]">
				{error}
			</div>
		</div>
	{/if}

	<!-- ── New Hook Form (Double-Bezel) ──────────────────────────────────────── -->
	{#if canWrite}
		<section class="reveal-entry mb-10" use:reveal={80}>
			<!-- Outer shell -->
			<div class="rounded-[1.75rem] border border-[var(--gw-color-border)] bg-[var(--gw-color-border)]/30 p-[3px]">
				<!-- Inner core -->
				<div class="rounded-[calc(1.75rem-3px)] bg-[var(--gw-color-surface)] px-6 py-8 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] sm:px-8">

					<div class="mb-7 flex items-baseline gap-3">
						<h2 class="text-xl font-semibold tracking-tight text-[var(--gw-color-text)]">New hook</h2>
						<span class="text-xs text-[var(--gw-color-text-muted)]">ID auto-generated</span>
					</div>

					<form class="flex flex-col gap-6" onsubmit={register}>

						<!-- Event + Matcher -->
						<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div class="flex flex-col gap-1.5">
								<label for="hk-event" class="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">
									Event
								</label>
								<div class="field-wrap">
									<select id="hk-event" class="field-input" bind:value={form.event}>
										{#each EVENT_TYPES as ev (ev)}
											<option value={ev}>{ev}</option>
										{/each}
									</select>
								</div>
							</div>
							<div class="flex flex-col gap-1.5">
								<label for="hk-matcher" class="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">
									Matcher
									<span class="ml-1 normal-case tracking-normal text-[var(--gw-color-text-muted)]/60">— empty = all</span>
								</label>
								<div class="field-wrap">
									<input
										id="hk-matcher"
										class="field-input font-mono"
										bind:value={form.matcher}
										placeholder="Bash(rm -rf /*)"
									/>
								</div>
							</div>
						</div>

						<!-- Command -->
						<div class="flex flex-col gap-1.5">
							<label for="hk-command" class="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">
								Command
							</label>
							<div class="field-wrap">
								<input
									id="hk-command"
									class="field-input font-mono"
									bind:value={form.command}
									placeholder="echo '❌ BLOCKED' && exit 2"
									required
								/>
							</div>
						</div>

						<!-- Target scope selectors -->
						<div class="flex flex-col gap-3">
							<p class="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">
								Target scope
								<span class="ml-1 normal-case tracking-normal text-[var(--gw-color-text-muted)]/60">— ⌘/Ctrl-click to multi-select · none = all</span>
							</p>
							<div class="grid grid-cols-1 gap-3 md:grid-cols-3">
								<div class="flex flex-col gap-1.5">
									<span class="text-[11px] text-[var(--gw-color-text-muted)]">Workspaces</span>
									<div class="field-wrap overflow-hidden">
										<select class="field-input" multiple size={Math.min(6, Math.max(3, workspaces.length))} bind:value={form.workspaces}>
											{#each workspaces as ws (ws.id)}
												<option value={ws.id}>{ws.name || ws.id}</option>
											{/each}
										</select>
									</div>
								</div>
								<div class="flex flex-col gap-1.5">
									<span class="text-[11px] text-[var(--gw-color-text-muted)]">Rigs · current workspace</span>
									<div class="field-wrap overflow-hidden">
										<select class="field-input" multiple size={Math.min(6, Math.max(3, rigs.length))} bind:value={form.rigs}>
											{#each rigs as r (r.name)}
												<option value={r.name}>{r.name}</option>
											{/each}
										</select>
									</div>
								</div>
								<div class="flex flex-col gap-1.5">
									<span class="text-[11px] text-[var(--gw-color-text-muted)]">Roles</span>
									<div class="field-wrap overflow-hidden">
										<select class="field-input" multiple size={6} bind:value={form.roles}>
											{#each ROLES as role (role)}
												<option value={role}>{role}</option>
											{/each}
										</select>
									</div>
								</div>
							</div>
						</div>

						<!-- CTA — Button-in-Button -->
						<div class="flex items-center pt-1">
							<button
								type="submit"
								disabled={busy}
								class="group flex items-center gap-2 rounded-full bg-[var(--gw-color-primary)] px-5 py-2.5 text-sm font-medium text-white
									transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
									hover:opacity-90 active:scale-[0.98]
									disabled:cursor-not-allowed disabled:opacity-40
									focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gw-color-primary-focus)] focus-visible:ring-offset-2"
							>
								{busy ? 'Registering…' : 'Register hook'}
								<span class="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px">
									<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
										<path d="M1.5 8.5L8.5 1.5M8.5 1.5H3.5M8.5 1.5V6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
									</svg>
								</span>
							</button>
						</div>

					</form>
				</div>
			</div>
		</section>
	{/if}

	<!-- ── Hooks list ─────────────────────────────────────────────────────────── -->
	{#if loading}
		<div class="flex items-center gap-3 py-16 text-sm text-[var(--gw-color-text-muted)]">
			<span class="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--gw-color-primary)]"></span>
			Loading
		</div>

	{:else if list.length === 0}
		<div class="flex flex-col items-center gap-3 py-24 text-center">
			<span class="text-4xl opacity-20">∅</span>
			<p class="text-sm text-[var(--gw-color-text-muted)]">No hooks registered.</p>
		</div>

	{:else}
		<div class="flex flex-col gap-4">
			{#each [...byEvent] as [event, hooks], gi (event)}
				<div class="reveal-entry" use:reveal={gi * 55}>
					<!-- Outer shell -->
					<div class="rounded-[1.5rem] border border-[var(--gw-color-border)] bg-[var(--gw-color-border)]/20 p-[3px]">
						<!-- Inner core -->
						<div class="overflow-hidden rounded-[calc(1.5rem-3px)] bg-[var(--gw-color-surface)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">

							<!-- Event header -->
							<div class="flex items-center gap-3 border-b border-[var(--gw-color-border)] px-5 py-4">
								<span class="rounded-full bg-[var(--gw-color-primary)]/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-[var(--gw-color-primary)]">
									{event}
								</span>
								<span class="text-xs text-[var(--gw-color-text-muted)]">
									{hooks.length} {hooks.length === 1 ? 'hook' : 'hooks'}
								</span>
							</div>

							<!-- Desktop table -->
							<div class="hidden md:block overflow-x-auto">
								<table class="w-full text-xs">
									<thead>
										<tr class="border-b border-[var(--gw-color-border)]/50">
											<th class="col-header px-5 py-2.5 text-left">ID</th>
											<th class="col-header px-3 py-2.5 text-left">Matcher</th>
											<th class="col-header px-3 py-2.5 text-left">Command</th>
											<th class="col-header px-3 py-2.5 text-left">Workspaces</th>
											<th class="col-header px-3 py-2.5 text-left">Rigs</th>
											<th class="col-header px-3 py-2.5 text-left">Roles</th>
											{#if canWrite}<th class="px-3 py-2.5"></th>{/if}
										</tr>
									</thead>
									<tbody>
										{#each hooks as h, ri (h.id)}
											<tr class="group transition-colors duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-[var(--gw-color-surface-2)] {ri < hooks.length - 1 ? 'border-b border-[var(--gw-color-border)]/40' : ''}">
												<td class="px-5 py-3">
													<code class="font-mono text-[10px] text-[var(--gw-color-text-muted)]">{h.id}</code>
												</td>
												<td class="px-3 py-3">
													{#if h.matcher}
														<code class="code-chip">{h.matcher}</code>
													{:else}
														<span class="text-[var(--gw-color-text-muted)]">∗</span>
													{/if}
												</td>
												<td class="px-3 py-3 max-w-xs">
													<code class="code-chip">{h.command}</code>
												</td>
												<td class="px-3 py-3 text-[var(--gw-color-text-muted)]">{dim(h.target.workspaces)}</td>
												<td class="px-3 py-3 text-[var(--gw-color-text-muted)]">{dim(h.target.rigs)}</td>
												<td class="px-3 py-3 text-[var(--gw-color-text-muted)]">{dim(h.target.roles)}</td>
												{#if canWrite}
													<td class="px-3 py-3 text-right">
														<button
															disabled={busy}
															onclick={() => retire(h.id)}
															class="retire-btn"
														>
															Retire
														</button>
													</td>
												{/if}
											</tr>
										{/each}
									</tbody>
								</table>
							</div>

							<!-- Mobile cards -->
							<div class="flex flex-col divide-y divide-[var(--gw-color-border)]/40 md:hidden">
								{#each hooks as h (h.id)}
									<div class="flex flex-col gap-2.5 px-5 py-4">
										<div class="flex items-start justify-between gap-3">
											<code class="font-mono text-[10px] text-[var(--gw-color-text-muted)] break-all">{h.id}</code>
											{#if canWrite}
												<button disabled={busy} onclick={() => retire(h.id)} class="retire-btn shrink-0">
													Retire
												</button>
											{/if}
										</div>
										<div class="flex flex-col gap-1.5">
											<div class="flex items-center gap-2">
												<span class="text-[10px] uppercase tracking-wide text-[var(--gw-color-text-muted)]/60 w-16 shrink-0">Matcher</span>
												{#if h.matcher}
													<code class="code-chip">{h.matcher}</code>
												{:else}
													<span class="text-xs text-[var(--gw-color-text-muted)]">∗</span>
												{/if}
											</div>
											<div class="flex items-start gap-2">
												<span class="text-[10px] uppercase tracking-wide text-[var(--gw-color-text-muted)]/60 w-16 shrink-0 mt-0.5">Command</span>
												<code class="code-chip break-all">{h.command}</code>
											</div>
											<div class="flex items-center gap-2">
												<span class="text-[10px] uppercase tracking-wide text-[var(--gw-color-text-muted)]/60 w-16 shrink-0">Target</span>
												<span class="text-xs text-[var(--gw-color-text-muted)]">
													{dim(h.target.workspaces)} · {dim(h.target.rigs)} · {dim(h.target.roles)}
												</span>
											</div>
										</div>
									</div>
								{/each}
							</div>

						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}

</div>

<style>
	/* ── Scroll-reveal ────────────────────────────────────────────────────────── */
	.reveal-entry {
		opacity: 0;
		transform: translateY(16px);
		transition:
			opacity 0.65s cubic-bezier(0.32, 0.72, 0, 1) var(--reveal-delay, 0ms),
			transform 0.65s cubic-bezier(0.32, 0.72, 0, 1) var(--reveal-delay, 0ms);
	}
	:global(.reveal-entry.is-revealed) {
		opacity: 1;
		transform: translateY(0);
	}

	/* ── Form field wrapper + input ───────────────────────────────────────────── */
	.field-wrap {
		border-radius: 0.75rem;
		border: 1px solid var(--gw-color-border);
		background: var(--gw-color-surface-2);
		transition:
			border-color 0.25s cubic-bezier(0.32, 0.72, 0, 1),
			box-shadow 0.25s cubic-bezier(0.32, 0.72, 0, 1);
	}
	.field-wrap:focus-within {
		border-color: var(--gw-color-primary);
		box-shadow: 0 0 0 3px color-mix(in oklch, var(--gw-color-primary) 20%, transparent);
	}
	.field-input {
		display: block;
		width: 100%;
		background: transparent;
		border: none;
		outline: none;
		padding: 0.625rem 0.75rem;
		font-size: 0.875rem;
		color: var(--gw-color-text);
		border-radius: 0.75rem;
	}
	.field-input::placeholder {
		color: color-mix(in oklch, var(--gw-color-text-muted) 50%, transparent);
	}

	/* ── Table column header ──────────────────────────────────────────────────── */
	.col-header {
		font-size: 10px;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--gw-color-text-muted);
	}

	/* ── Code chip ────────────────────────────────────────────────────────────── */
	.code-chip {
		display: inline;
		border-radius: 0.375rem;
		background: var(--gw-color-surface-3);
		padding: 0.125rem 0.375rem;
		font-family: var(--gw-font-mono);
		font-size: 10px;
		color: var(--gw-color-text);
	}

	/* ── Retire button ────────────────────────────────────────────────────────── */
	.retire-btn {
		border-radius: 0.5rem;
		border: 1px solid var(--gw-color-border);
		padding: 0.2rem 0.625rem;
		font-size: 10px;
		font-weight: 500;
		color: var(--gw-color-text-muted);
		background: transparent;
		cursor: pointer;
		transition:
			border-color 0.2s cubic-bezier(0.32, 0.72, 0, 1),
			background 0.2s cubic-bezier(0.32, 0.72, 0, 1),
			color 0.2s cubic-bezier(0.32, 0.72, 0, 1),
			transform 0.15s cubic-bezier(0.32, 0.72, 0, 1);
	}
	.retire-btn:hover {
		border-color: color-mix(in oklch, var(--color-error-500) 40%, transparent);
		background: color-mix(in oklch, var(--color-error-500) 8%, transparent);
		color: var(--color-error-500);
	}
	.retire-btn:active {
		transform: scale(0.97);
	}
	.retire-btn:disabled {
		cursor: not-allowed;
		opacity: 0.4;
	}
	.retire-btn:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--gw-color-primary-focus);
	}
</style>
