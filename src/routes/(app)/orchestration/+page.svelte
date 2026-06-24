<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { browserOrch, roleToWire, type SpawnRole } from '$lib/api/orch';
	import { TrackerError } from '$lib/api/tracker';
	import { hasScope } from '$lib/api/auth';
	import { terminals } from '$lib/stores/terminals.svelte';
	import { Badge, Button, Input } from '$lib/ui';
	import { Alert, EmptyState } from '$lib/components/ui';
	import LiveFeed from '$lib/components/orchestration/LiveFeed.svelte';
	import MessageDrawer from '$lib/components/orchestration/MessageDrawer.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type Tab = 'sessions' | 'merge' | 'convoy' | 'quota';
	let tab = $state<Tab>('sessions');
	let error = $state('');
	let busy = $state(false);

	// A2A message drawer state — null when closed, session id when open.
	let drawerSession = $state<string | null>(null);

	const canAgent = $derived(hasScope(data.user?.scopes, 'agent.write'));
	const canTerminal = $derived(hasScope(data.user?.scopes, 'terminal.exec'));

	// Open an interactive terminal for a session in the floating dock (hq-term-dock.2): no route
	// navigation — the dock hovers over the orchestration view.
	const openTerminal = (id: string) => terminals.open(id);
	const canMerge = $derived(hasScope(data.user?.scopes, 'merge.write'));
	const canConvoy = $derived(hasScope(data.user?.scopes, 'convoy.write'));
	const canQuota = $derived(hasScope(data.user?.scopes, 'quota.write'));

	// hq-quota-ws-accounts.3: the deploy-global pool not yet assigned to this workspace — the
	// accounts the admin can attach here. Assigned ones live in the table below (data.quotas).
	const unassigned = $derived(data.quotaCatalog.filter((a) => !a.assigned));

	// Map a stored session rig to its display name. Sessions store EITHER the rig
	// prefix (orchd sets GT_RIG=prefix, e.g. "hq" for gt_core) OR the canonical name,
	// so match on either and resolve to the canonical name. Falls back to the raw
	// value so sessions spawned before a rig was registered still surface.
	const rigOf = (rig: string) =>
		data.rigs.find((r) => r.name === rig || r.prefix === rig)?.name ?? rig;

	// The agent's configured skills: its own spawn manifest if present, else the skills its ROLE
	// has in the catalog (hq-sessions-role-info.1). `fromRole` flags the catalog fallback.
	function agentSkills(s: { skills?: string[]; role: string }): { skills: string[]; fromRole: boolean } {
		if (s.skills?.length) return { skills: s.skills, fromRole: false };
		return { skills: data.roleConfig?.[s.role]?.skills ?? [], fromRole: true };
	}
	const roleHasPrompt = (role: string) => data.roleConfig?.[role]?.hasPrompt ?? false;

	// State filter for the sessions list — "active" is the default so noise is minimal.
	type SessionFilter = 'active' | 'all' | 'done';
	let sessionFilter = $state<SessionFilter>('active');

	const ACTIVE_STATES = new Set(['spawned', 'working']);
	const DONE_STATES = new Set(['done', 'killed']);

	// Sessions are scoped to the active rig (chosen globally in the header); when no rig is
	// selected ("all rigs") every session shows. State filter applies on top of the rig filter.
	const rigSessions = $derived(
		data.activeRig ? data.agents.filter((s) => rigOf(s.rig) === data.activeRig) : data.agents
	);
	const sessions = $derived(
		sessionFilter === 'active'
			? rigSessions.filter((s) => ACTIVE_STATES.has(s.state))
			: sessionFilter === 'done'
				? rigSessions.filter((s) => DONE_STATES.has(s.state))
				: rigSessions
	);
	const activeCount = $derived(rigSessions.filter((s) => ACTIVE_STATES.has(s.state)).length);

	// Merge state filter — "active" shows in-flight slots only.
	type MergeFilter = 'active' | 'all';
	let mergeFilter = $state<MergeFilter>('active');
	const MERGE_ACTIVE = new Set(['Ready', 'Merging']);
	const merges = $derived(
		mergeFilter === 'active'
			? data.merges.filter((m) => MERGE_ACTIVE.has(m.state))
			: data.merges
	);
	const mergeActiveCount = $derived(data.merges.filter((m) => MERGE_ACTIVE.has(m.state)).length);

	// Convoy state filter — "active" shows convoys not yet completed/failed.
	type ConvoyFilter = 'active' | 'all';
	let convoyFilter = $state<ConvoyFilter>('active');
	const CONVOY_DONE = new Set(['completed', 'failed', 'Completed', 'Failed']);
	const convoys = $derived(
		convoyFilter === 'active'
			? data.convoys.filter((c) => !CONVOY_DONE.has(c.state))
			: data.convoys
	);
	const convoyActiveCount = $derived(data.convoys.filter((c) => !CONVOY_DONE.has(c.state)).length);

	const TABS: { id: Tab; label: string; count: number }[] = $derived([
		{ id: 'sessions', label: 'Sessions', count: activeCount },
		{ id: 'merge', label: 'Merge', count: mergeActiveCount },
		{ id: 'convoy', label: 'Convoy', count: convoyActiveCount },
		{ id: 'quota', label: 'Quota', count: data.quotas.length }
	]);

	async function run(fn: () => Promise<unknown>) {
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

	const o = browserOrch();

	function killSession(id: string) {
		const reason = prompt(`Kill session ${id} — reason?`, 'killed from console');
		if (reason === null) return; // cancelled
		run(() => o.killAgent(id, reason || 'killed from console'));
	}

	// hq-orch-sessions.1: every spawnable role, dogs included. The roles for which `crew` is
	// meaningful (it runs INSIDE a polecat).
	const SPAWN_ROLES: SpawnRole[] = [
		'polecat',
		'mayor',
		'witness',
		'refinery',
		'deacon',
		'overseer',
		'sheriff',
		'dog'
	];

	let spawn = $state<{ role: SpawnRole; crew: string }>({
		role: 'polecat',
		crew: ''
	});

	// Session id is auto-generated as a short hash — the user no longer types it, and the rig is
	// the header's active rig (chosen globally), so neither is a form field anymore.
	const genSessionId = (role: SpawnRole) =>
		`${role}-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;

	// hq-orch-sessions.4: crews already seen across sessions, offered in the spawn datalist so a
	// crew can be re-selected as well as typed fresh.
	const knownCrews = $derived(
		[...new Set(data.agents.map((s) => s.crew).filter((c): c is string => !!c))].sort()
	);

	function submitSpawn(e: SubmitEvent) {
		e.preventDefault();
		if (!data.activeRig?.trim()) {
			error = 'no active rig selected';
			return;
		}
		// Store the rig PREFIX as the session rig field, matching what orchd writes
		// (GT_RIG = prefix, e.g. "hq" for gt_core which stays prefix≠name). rigOf maps
		// it back to the canonical name for display. The loader fetches all sessions
		// and resolves client-side, so no ?rig filter has to agree on the form.
		const rig = data.rigs.find((r) => r.name === data.activeRig)?.prefix ?? data.activeRig;
		run(async () => {
			await o.spawnAgent({
				session: genSessionId(spawn.role),
				rig,
				role: roleToWire(spawn.role),
				// crew only meaningful for a polecat; omit otherwise so the backend default stands.
				crew: spawn.role === 'polecat' && spawn.crew.trim() ? spawn.crew.trim() : undefined
			});
			spawn = { role: 'polecat', crew: '' };
		});
	}

	const stateVariant = (s: string) => {
		switch (s.toLowerCase()) {
			case 'working':
			case 'merging':
				return 'warning';
			case 'done':
			case 'merged':
			case 'healthy':
				return 'success';
			case 'killed':
			case 'failed':
				return 'error';
			default:
				return 'surface';
		}
	};

	// Infrastructure roles: long-running daemons that don't send periodic heartbeats.
	const INFRA_ROLES = new Set(['refinery', 'mayor', 'sheriff', 'witness', 'deacon']);
	const isInfra = (s: { role: string; maintains_heartbeat?: boolean }) =>
		INFRA_ROLES.has(s.role) || s.maintains_heartbeat === false;

	function relativeHb(secs: number | undefined | null, now: number): string {
		if (secs == null) return '—';
		const d = now - secs;
		if (d < 90) return `${d}s ago`;
		if (d < 3600) return `${Math.floor(d / 60)}m ago`;
		return `${Math.floor(d / 3600)}h ago`;
	}

	// The tick also re-runs the load so server-side quota status lifts reach the pills live.
	let nowSecs = $state(Math.floor(Date.now() / 1000));
	$effect(() => {
		const t = setInterval(() => {
			nowSecs = Math.floor(Date.now() / 1000);
			void invalidateAll();
		}, 30_000);
		return () => clearInterval(t);
	});

	/** A window whose reset instant already passed: stale `consumed` until the next probe. */
	const isExpired = (w: { resets_at_secs: number }, now: number) => now >= w.resets_at_secs;

	// Mirrors /admin/quota (gtweb-71fa71): expired windows contribute no warning, and the
	// rate×duration projection only makes sense for Rolling5h windows.
	const warningPct = (w: { kind: string; consumed: number; limit: number; started_at_secs: number; resets_at_secs: number }, now: number): number => {
		if (w.limit === 0 || isExpired(w, now)) return 0;
		const actual = (w.consumed / w.limit) * 100;
		if (w.kind !== 'Rolling5h') return Math.min(100, actual);
		const elapsed = Math.max(now - w.started_at_secs, 60);
		const rate = w.consumed / elapsed;
		const duration = w.resets_at_secs - w.started_at_secs;
		const projected = (rate * duration / w.limit) * 100;
		return Math.min(100, Math.max(actual, projected));
	};

	// ── Design tokens ────────────────────────────────────────────────────────────
	const pillBase =
		'rounded-[var(--gw-radius-full)] px-[var(--gw-space-3)] py-[var(--gw-space-1)] ' +
		'text-[var(--gw-text-xs)] font-medium ' +
		'transition-all duration-[200ms] ease-[cubic-bezier(0.32,0.72,0,1)] ' +
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gw-color-primary-focus)] focus-visible:ring-offset-1';
	const pillActive =
		'bg-[var(--gw-color-surface)] text-[var(--gw-color-text)] ' +
		'shadow-[var(--gw-shadow-sm)] ring-1 ring-[var(--gw-color-border-subtle)]';
	const pillIdle =
		'text-[var(--gw-color-text-muted)] hover:bg-[var(--gw-color-surface-3)] hover:text-[var(--gw-color-text)]';
	const nativeField =
		'w-full transition-[border-color,box-shadow] duration-[var(--gw-duration-fast)] ' +
		'hover:border-[var(--gw-color-primary)] focus-visible:border-[var(--gw-color-primary)] ' +
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gw-color-primary-focus)]/30';
</script>

<style>
	@keyframes slide-up-fade {
		from {
			opacity: 0;
			transform: translateY(12px);
			filter: blur(3px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
			filter: blur(0);
		}
	}

	.entry {
		animation: slide-up-fade 560ms cubic-bezier(0.32, 0.72, 0, 1) both;
	}
	.entry-1 { animation-delay: 0ms; }
	.entry-2 { animation-delay: 70ms; }
	.entry-3 { animation-delay: 0ms; }
	.entry-4 { animation-delay: 60ms; }
	.entry-5 { animation-delay: 120ms; }

	/* Outer bezel shell */
	.bezel {
		border-radius: 1.125rem;
		border: 1px solid var(--gw-color-border-subtle);
		background-color: var(--gw-color-surface-3);
		padding: 3px;
	}

	/* Inner bezel core */
	.bezel-inner {
		border-radius: calc(1.125rem - 3px);
		background-color: var(--gw-color-surface);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
	}

	.bezel-inner-overflow {
		border-radius: calc(1.125rem - 3px);
		background-color: var(--gw-color-surface);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
		overflow: hidden;
	}

	/* Premium table row hover */
	.premium-row {
		transition: background-color 160ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.premium-row:hover {
		background-color: var(--gw-color-surface-3);
	}

	/* Infra daemon rows (refinery/mayor/sheriff/witness/deacon) get a subtle left accent. */
	.infra-row td:first-child {
		border-left: 2px solid color-mix(in oklch, var(--gw-color-primary) 40%, transparent);
	}

	.badge-healthy {
		display: inline-flex; align-items: center; gap: 4px; border-radius: 9999px;
		background-color: oklch(96% 0.05 150); border: 1px solid oklch(85% 0.1 150);
		color: oklch(42% 0.16 150); font-size: 10px; font-weight: 600;
		padding: 2px 7px; text-transform: uppercase; letter-spacing: 0.06em;
	}
	.badge-warn {
		display: inline-flex; align-items: center; gap: 4px; border-radius: 9999px;
		background-color: oklch(97% 0.04 80); border: 1px solid oklch(88% 0.1 80);
		color: oklch(52% 0.18 80); font-size: 10px; font-weight: 600;
		padding: 2px 7px; text-transform: uppercase; letter-spacing: 0.06em;
	}
	.badge-disabled {
		display: inline-flex; align-items: center; gap: 4px; border-radius: 9999px;
		background-color: oklch(97% 0.03 25); border: 1px solid oklch(88% 0.1 25);
		color: oklch(45% 0.22 25); font-size: 10px; font-weight: 600;
		padding: 2px 7px; text-transform: uppercase; letter-spacing: 0.06em;
	}
	.badge-reset {
		display: inline-flex; align-items: center; gap: 4px; border-radius: 9999px;
		background-color: oklch(96% 0.04 190); border: 1px solid oklch(85% 0.08 190);
		color: oklch(42% 0.12 190); font-size: 10px; font-weight: 600;
		padding: 2px 7px; text-transform: uppercase; letter-spacing: 0.06em;
	}
</style>

<div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_18rem]">
	<div class="space-y-5">

		<!-- ── Header ─────────────────────────────────────────────────────── -->
		<header class="entry entry-1 space-y-2">
			<span
				class="inline-flex items-center gap-[6px] rounded-full
					border border-[var(--gw-color-border-subtle)]
					bg-[var(--gw-color-surface-3)]
					px-[var(--gw-space-3)] py-[3px]
					text-[10px] font-medium uppercase tracking-[0.14em]
					text-[var(--gw-color-text-muted)]"
			>
				<span
					class="inline-block h-[6px] w-[6px] shrink-0 rounded-full"
					style="background-color: var(--gw-color-success);
					       box-shadow: 0 0 0 2px color-mix(in oklch, var(--gw-color-success) 20%, transparent);"
				></span>
				Operations Console
			</span>
			<div class="flex items-end justify-between gap-4">
				<h1
					class="text-[var(--gw-text-3xl)] font-semibold leading-[var(--gw-leading-tight)]
						tracking-tight text-[var(--gw-color-text)]"
				>
					Orchestration
				</h1>
				<div class="flex shrink-0 items-center gap-2 pb-0.5">
					<span
						class="rounded-full border border-[var(--gw-color-border-subtle)]
							bg-[var(--gw-color-surface-3)]
							px-[var(--gw-space-3)] py-[var(--gw-space-1)]
							text-[var(--gw-text-xs)] tabular-nums text-[var(--gw-color-text-muted)]"
					>
						{activeCount} active
					</span>
					<span
						class="rounded-full border border-[var(--gw-color-border-subtle)]
							bg-[var(--gw-color-surface-3)]
							px-[var(--gw-space-3)] py-[var(--gw-space-1)]
							text-[var(--gw-text-xs)] tabular-nums text-[var(--gw-color-text-muted)]"
					>
						{rigSessions.length} total
					</span>
					<Button variant="tonal" class="btn-sm" onclick={() => (drawerSession = '')}>All Msg</Button>
				</div>
			</div>
		</header>

		<!-- ── Floating pill tab group ────────────────────────────────────── -->
		<nav
			class="entry entry-2 flex w-fit items-center gap-[3px] rounded-[1.125rem]
				border border-[var(--gw-color-border-subtle)]
				bg-[var(--gw-color-surface-3)] p-[3px]"
			aria-label="Orchestration views"
		>
			{#each TABS as t (t.id)}
				{@const active = tab === t.id}
				<button
					aria-current={active ? 'page' : undefined}
					class="relative flex items-center gap-2 rounded-[calc(1.125rem-6px)]
						px-[var(--gw-space-3)] py-[var(--gw-space-2)]
						text-[var(--gw-text-sm)] font-medium
						transition-all duration-[200ms] ease-[cubic-bezier(0.32,0.72,0,1)]
						focus-visible:outline-none focus-visible:ring-2
						focus-visible:ring-[var(--gw-color-primary-focus)]
						{active
							? 'bg-[var(--gw-color-surface)] text-[var(--gw-color-text)] shadow-[var(--gw-shadow-sm)]'
							: 'text-[var(--gw-color-text-muted)] hover:text-[var(--gw-color-text)]'}"
					onclick={() => (tab = t.id)}
				>
					{t.label}
					{#if t.count > 0}
						<span
							class="flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1
								text-[10px] font-semibold tabular-nums
								transition-colors duration-[200ms]
								{active
									? 'bg-[var(--gw-color-primary-subtle)] text-[var(--gw-color-primary)]'
									: 'bg-[var(--gw-color-border)] text-[var(--gw-color-text-muted)]'}"
						>{t.count}</span>
					{/if}
				</button>
			{/each}
		</nav>

		{#if error}<Alert variant="error">{error}</Alert>{/if}

		<!-- ══ SESSIONS ══════════════════════════════════════════════════════ -->
		{#if tab === 'sessions'}
			{#if data.errors.agents}<Alert variant="error">{data.errors.agents}</Alert>{/if}

			{#if canAgent}
				<!-- Spawn form — Double-Bezel card -->
				<div class="bezel entry entry-3">
					<div class="bezel-inner px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
						<p class="mb-[var(--gw-space-3)] text-[10px] font-semibold uppercase
							tracking-[0.12em] text-[var(--gw-color-text-muted)]">
							Spawn agent
						</p>
						<form class="flex flex-wrap items-end gap-[var(--gw-space-2)]" onsubmit={submitSpawn}>
							<label class="flex flex-col gap-[var(--gw-space-1)] text-[var(--gw-text-xs)]">
								<span class="text-[var(--gw-color-text-muted)]">Role</span>
								<select class="select w-32 {nativeField}" bind:value={spawn.role}>
									{#each SPAWN_ROLES as r (r)}<option value={r}>{r}</option>{/each}
								</select>
							</label>
							{#if spawn.role === 'polecat'}
								<label class="flex flex-col gap-[var(--gw-space-1)] text-[var(--gw-text-xs)]">
									<span class="text-[var(--gw-color-text-muted)]">Crew (optional)</span>
									<Input class="w-40" type="text" list="known-crews" bind:value={spawn.crew} placeholder="ada" />
									<datalist id="known-crews">
										{#each knownCrews as c (c)}<option value={c}></option>{/each}
									</datalist>
								</label>
							{/if}
							<Button type="submit" disabled={busy}>Spawn</Button>
						</form>
					</div>
				</div>
			{/if}

			<!-- State filter pills -->
			<div class="entry entry-4 flex items-center gap-[var(--gw-space-1)]">
				{#each ([['active', 'Active'], ['all', 'All'], ['done', 'Ended']] as const) as [id, label] (id)}
					<button
						class="{pillBase} {sessionFilter === id ? pillActive : pillIdle}"
						onclick={() => (sessionFilter = id)}
					>
						{label}
						{#if id === 'active'}
							<span class="opacity-60">({activeCount})</span>
						{:else if id === 'all'}
							<span class="opacity-60">({rigSessions.length})</span>
						{:else}
							<span class="opacity-60">({rigSessions.filter((s) => DONE_STATES.has(s.state)).length})</span>
						{/if}
					</button>
				{/each}
			</div>

			{#if sessions.length === 0}
				<EmptyState
					icon="▷"
					title={sessionFilter === 'active' ? 'Sin sesiones activas' : 'Sin sesiones'}
					description={sessionFilter === 'active'
						? 'No hay agentes corriendo en este rig. Lanza uno con el formulario de arriba.'
						: 'Aún no hay sesiones registradas para este rig.'}
				/>
			{:else}
				<!-- Double-Bezel table card -->
				<div class="bezel entry entry-5">
					<div class="bezel-inner-overflow">
						<table class="table">
							<thead>
								<tr><th>Session</th><th>Rig</th><th>Role</th><th>Crew</th><th>Skills</th><th>Hooks</th><th>Last HB</th><th>State</th><th></th></tr>
							</thead>
							<tbody>
								{#each sessions as s (s.id)}
									{@const cfg = agentSkills(s)}
									{@const infra = isInfra(s)}
									<tr class="premium-row {infra ? 'infra-row' : ''}">
										<td class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)]">{s.id}</td>
										<td>{rigOf(s.rig)}</td>
										<td>
											<span class="flex items-center gap-1">
												{s.role}
												{#if infra}<Badge variant="surface" class="text-[9px] opacity-70">infra</Badge>{/if}
												{#if roleHasPrompt(s.role)}<Badge variant="primary" class="text-[9px]">prompt</Badge>{/if}
											</span>
										</td>
										<td>{s.crew ?? '—'}</td>
										<td>
											{#if cfg.skills.length}
												<!-- Hover popover with the active skills (hq-sessions-layout-fix.3). -->
												<span class="group relative inline-block">
													<Badge variant={cfg.fromRole ? 'surface' : 'success'} class="cursor-default whitespace-nowrap">
														{cfg.skills.length} skills
													</Badge>
													<span
														class="invisible absolute left-0 top-full z-30 mt-1 w-max max-w-xs
															rounded-[var(--gw-radius-md)] border border-[var(--gw-color-border-subtle)]
															bg-[var(--gw-color-surface)] p-[var(--gw-space-2)] opacity-0 shadow-[var(--gw-shadow-lg)]
															transition-opacity group-hover:visible group-hover:opacity-100"
													>
														<span class="mb-1 block text-[10px] uppercase text-[var(--gw-color-text-muted)]">
															{cfg.fromRole ? 'role config' : 'spawn manifest'}
														</span>
														<span class="flex flex-wrap gap-1">
															{#each cfg.skills as sk (sk)}<Badge variant="surface">{sk}</Badge>{/each}
														</span>
													</span>
												</span>
											{:else}—{/if}
										</td>
										<td>
											{#if s.hooks?.length}
												<span class="flex flex-wrap gap-1">
													{#each s.hooks as hk (hk)}<Badge variant="surface">{hk}</Badge>{/each}
												</span>
											{:else}—{/if}
										</td>
										<td class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)] tabular-nums text-[var(--gw-color-text-muted)]">
											{#if infra && s.last_heartbeat_at == null}
												<span title="Infra daemon — no heartbeat expected">N/A</span>
											{:else}
												{relativeHb(s.last_heartbeat_at, nowSecs)}
											{/if}
										</td>
										<td><Badge variant={stateVariant(s.state)}>{s.state}</Badge></td>
										<td>
											<div class="flex flex-nowrap items-center justify-end gap-1 whitespace-nowrap">
												<Button variant="tonal" class="btn-sm" onclick={() => (drawerSession = s.id)}>Msg</Button>
												{#if canTerminal}
													<Button variant="tonal" class="btn-sm" onclick={() => openTerminal(s.id)}>Terminal</Button>
												{/if}
												{#if canAgent}
													<Button variant="tonal" class="btn-sm" disabled={busy} onclick={() => run(() => o.heartbeatAgent(s.id))}>Heartbeat</Button>
													<Button variant="tonal" class="btn-sm" disabled={busy} onclick={() => run(() => o.endAgent(s.id))}>End</Button>
													<Button variant="tonal" class="btn-sm" disabled={busy} onclick={() => killSession(s.id)}>Kill</Button>
												{/if}
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}

		<!-- ══ MERGE ══════════════════════════════════════════════════════════ -->
		{:else if tab === 'merge'}
			{#if data.errors.merges}<Alert variant="error">{data.errors.merges}</Alert>{/if}

			<div class="entry entry-3 flex items-center gap-[var(--gw-space-1)]">
				{#each ([['active', 'Active'], ['all', 'All']] as const) as [id, label] (id)}
					<button
						class="{pillBase} {mergeFilter === id ? pillActive : pillIdle}"
						onclick={() => (mergeFilter = id)}
					>
						{label}
						<span class="opacity-60">({id === 'active' ? mergeActiveCount : data.merges.length})</span>
					</button>
				{/each}
			</div>

			{#if merges.length === 0}
				<EmptyState
					icon="⇄"
					title={mergeFilter === 'active' ? 'Sin merges en vuelo' : 'Cola de merge vacía'}
					description="No hay slots de merge para mostrar con este filtro."
				/>
			{:else}
				<div class="bezel entry entry-4">
					<div class="bezel-inner-overflow">
						<table class="table">
							<thead>
								<tr><th>Bead</th><th>Branch</th><th>State</th><th></th></tr>
							</thead>
							<tbody>
								{#each merges as m (m.bead)}
									<tr class="premium-row">
										<td class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)]">{m.bead}</td>
										<td class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)]">{m.branch}</td>
										<td><Badge variant={stateVariant(m.state)}>{m.state}</Badge></td>
										<td class="text-right">
											{#if canMerge}
												{#if m.state === 'Ready'}
													<Button variant="tonal" disabled={busy} onclick={() => run(() => o.startMerge(m.bead))}>Start</Button>
												{:else if m.state === 'Merging'}
													<Button variant="tonal" disabled={busy} onclick={() => run(() => o.completeMerge(m.bead))}>Complete</Button>
													<Button variant="tonal" disabled={busy} onclick={() => run(() => o.failMerge(m.bead))}>Fail</Button>
												{/if}
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}

		<!-- ══ CONVOY ════════════════════════════════════════════════════════ -->
		{:else if tab === 'convoy'}
			{#if data.errors.convoys}<Alert variant="error">{data.errors.convoys}</Alert>{/if}

			<div class="entry entry-3 flex items-center gap-[var(--gw-space-1)]">
				{#each ([['active', 'Active'], ['all', 'All']] as const) as [id, label] (id)}
					<button
						class="{pillBase} {convoyFilter === id ? pillActive : pillIdle}"
						onclick={() => (convoyFilter = id)}
					>
						{label}
						<span class="opacity-60">({id === 'active' ? convoyActiveCount : data.convoys.length})</span>
					</button>
				{/each}
			</div>

			{#if convoys.length === 0}
				<EmptyState
					icon="⛓"
					title={convoyFilter === 'active' ? 'Sin convoys activos' : 'Sin convoys'}
					description="No hay convoys para mostrar con este filtro."
				/>
			{:else}
				<div class="entry entry-4 space-y-[var(--gw-space-3)]">
					{#each convoys as c (c.id)}
						<div class="bezel">
							<div class="bezel-inner">
								<header
									class="flex items-center gap-[var(--gw-space-2)]
										border-b border-[var(--gw-color-border-subtle)]
										px-[var(--gw-space-4)] py-[var(--gw-space-3)]"
								>
									<span class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-sm)] text-[var(--gw-color-text)]">{c.id}</span>
									<Badge variant={stateVariant(c.state)}>{c.state}</Badge>
								</header>
								<table class="table">
									<tbody>
										{#each c.members as m (m.bead)}
											<tr class="premium-row">
												<td class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)]">{m.bead}</td>
												<td><Badge variant={stateVariant(m.state)}>{m.state}</Badge></td>
												<td class="text-right">
													{#if canConvoy && m.state.toLowerCase() === 'active'}
														<Button variant="tonal" disabled={busy} onclick={() => run(() => o.completeMember(c.id, m.bead))}>Complete</Button>
														<Button variant="tonal" disabled={busy} onclick={() => run(() => o.failMember(c.id, m.bead, 'failed via gt-web'))}>Fail</Button>
													{/if}
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					{/each}
				</div>
			{/if}

		<!-- ══ QUOTA ══════════════════════════════════════════════════════════ -->
		{:else}
			{#if data.errors.quotas}<Alert variant="error">{data.errors.quotas}</Alert>{/if}

			<!-- hq-quota-ws-accounts.3: assign accounts from the deploy-global pool to THIS workspace.
			     /admin/quota administers the pool itself (onboard/retire). -->
			{#if canQuota && unassigned.length > 0}
				<div class="entry entry-3 space-y-[var(--gw-space-2)]">
					<h2 class="text-[var(--gw-text-sm)] font-semibold text-[var(--gw-color-text)]">
						Available accounts
						<span class="text-[var(--gw-color-text-muted)]">({unassigned.length})</span>
					</h2>
					<div class="bezel">
						<div class="bezel-inner p-[var(--gw-space-3)]">
							<div class="flex flex-wrap gap-[var(--gw-space-2)]">
								{#each unassigned as a (a.id)}
									<span
										class="flex items-center gap-[var(--gw-space-2)] rounded-[var(--gw-radius-md)]
											preset-tonal-surface px-[var(--gw-space-2)] py-[var(--gw-space-1)]
											text-[var(--gw-text-sm)]"
									>
										<span class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)]">{a.id}</span>
										<Button variant="tonal" disabled={busy} onclick={() => run(() => o.assignAccount(a.id))}>Assign</Button>
									</span>
								{/each}
							</div>
						</div>
					</div>
				</div>
			{/if}

			<h2 class="entry entry-4 text-[var(--gw-text-sm)] font-semibold text-[var(--gw-color-text)]">
				Assigned to this workspace
				<span class="text-[var(--gw-color-text-muted)]">({data.quotas.length})</span>
			</h2>

			{#if data.quotas.length === 0}
				<EmptyState
					icon="◷"
					title="Sin cuentas de cuota"
					description="Este workspace no tiene cuentas asignadas. Asigna una del pool de arriba."
				/>
			{:else}
				<div class="bezel entry entry-5">
					<div class="bezel-inner-overflow">
						<table class="table">
							<thead>
								<tr>
									<th>Account</th><th>Status</th><th>Tokens</th><th>Resets</th><th></th>
								</tr>
							</thead>
							<tbody>
								{#each data.quotas as a (a.id)}
									{@const wins = [a.window, a.weekly_window].filter((w) => !!w)}
									{@const sampledQ = a.sampled_since_probe ?? 0}
									{@const maxWarnPct = wins.length ? Math.max(...wins.map((w) => warningPct(w, nowSecs))) : 0}
									{@const allExpired = wins.length > 0 && wins.every((w) => isExpired(w, nowSecs))}
									<tr class="premium-row">
										<td class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)]">{a.id}</td>
										<td>
										{#if a.status === 'Disabled'}
											<span class="badge-disabled"><span class="h-1.5 w-1.5 rounded-full bg-current"></span>{a.status}</span>
										{:else if a.status === 'Healthy' && maxWarnPct >= 90}
											<span class="badge-warn"><span class="h-1.5 w-1.5 rounded-full bg-current"></span>{a.status}</span>
										{:else if a.status === 'Healthy'}
											<span class="badge-healthy"><span class="h-1.5 w-1.5 rounded-full bg-current"></span>{a.status}</span>
										{:else if allExpired}
											<!-- Window(s) already reset: stale block awaiting re-probe (parity with /admin/quota). -->
											<span class="badge-reset" title="{a.status} — window reset, awaiting re-probe"><span class="h-1.5 w-1.5 rounded-full bg-current"></span>Resetting</span>
										{:else}
											<span class="badge-warn"><span class="h-1.5 w-1.5 rounded-full bg-current"></span>{a.status}</span>
										{/if}
									</td>
										<td>
											{#if wins.length}
												<div class="flex items-center gap-[var(--gw-space-3)]">
													{#each wins as w}
														{@const bwQ = w.limit === 0 || isExpired(w, nowSecs)
															? { confirmed: 0, sampled: 0 }
															: { confirmed: Math.min(100, ((w.consumed - sampledQ) / w.limit) * 100), sampled: Math.min(100, (sampledQ / w.limit) * 100) }}
														{@const dC = 2 * Math.PI * 13}
														{@const cL = (Math.max(0, bwQ.confirmed) / 100) * dC}
														{@const sL = (Math.max(0, bwQ.sampled) / 100) * dC}
														{@const cDeg = (Math.max(0, bwQ.confirmed) / 100) * 360}
														{@const tP = Math.round(Math.max(0, bwQ.confirmed) + Math.max(0, bwQ.sampled))}
														{@const dc = a.status === 'Disabled' ? 'var(--gw-color-error)' : maxWarnPct >= 90 ? 'oklch(52% 0.18 80)' : 'var(--gw-color-primary)'}
														<div class="flex flex-col items-center gap-[2px]">
															<svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
																<circle cx="18" cy="18" r="13" fill="none"
																	stroke="var(--gw-color-surface-3)" stroke-width="4" />
																{#if sL > 0.5}
																	<circle cx="18" cy="18" r="13" fill="none"
																		stroke={dc} stroke-opacity="0.3" stroke-width="4"
																		stroke-dasharray="{sL} {dC}"
																		transform="rotate({-90 + cDeg} 18 18)" />
																{/if}
																{#if cL > 0.5}
																	<circle cx="18" cy="18" r="13" fill="none"
																		stroke={dc} stroke-width="4"
																		stroke-dasharray="{cL} {dC}"
																		transform="rotate(-90 18 18)" />
																{/if}
																<text x="18" y="18" text-anchor="middle" dominant-baseline="central"
																	font-size="8" font-weight="700" fill="var(--gw-color-text)"
																	font-family="var(--gw-font-mono)">{tP}%</text>
															</svg>
															<span class="font-[family-name:var(--gw-font-mono)] text-[10px] text-[var(--gw-color-text-muted)]">{w.kind}</span>
														</div>
													{/each}
												</div>
											{:else}—{/if}
										</td>
										<td>
											{#if wins.length}
												<div class="flex flex-col gap-[var(--gw-space-2)]">
													{#each wins as w}
														<span class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
															{new Date(w.resets_at_secs * 1000).toLocaleString()}
														</span>
													{/each}
												</div>
											{:else}—{/if}
										</td>
										<td class="text-right">
											{#if canQuota}
												<Button variant="tonal" disabled={busy} onclick={() => run(() => o.detachAccount(a.id))}>Remove</Button>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}
		{/if}

	</div>

	<LiveFeed />
</div>

{#if drawerSession !== null}
	<MessageDrawer session={drawerSession || null} onclose={() => (drawerSession = null)} />
{/if}
