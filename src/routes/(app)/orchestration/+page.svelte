<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { browserOrch, roleToWire, type SpawnRole } from '$lib/api/orch';
	import { TrackerError } from '$lib/api/tracker';
	import { hasScope } from '$lib/api/auth';
	import { terminals } from '$lib/stores/terminals.svelte';
	import { Badge, Button, Input } from '$lib/ui';
	import { Alert, EmptyState } from '$lib/components/ui';
	import LiveFeed from '$lib/components/orchestration/LiveFeed.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type Tab = 'sessions' | 'merge' | 'convoy' | 'quota';
	let tab = $state<Tab>('sessions');
	let error = $state('');
	let busy = $state(false);

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

	// Map a stored session rig (the prefix, e.g. "hq", "gw") to the display rig name (e.g.
	// "gt_core", "gtweb") by looking up the rig catalog.  Falls back to the raw value so
	// sessions spawned before a rig was registered still surface rather than disappear.
	const rigOf = (rig: string) => data.rigs.find((r) => r.prefix === rig)?.name ?? rig;

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
		// Use the rig's PREFIX as the session rig field — this matches what orchd stores
		// (GT_RIG = prefix) and the ?rig=<prefix> filter the session loader sends.
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

	// ── Shared design-system class strings (gw-ui-redesign.4) ───────────────────
	// Filter pill: token padding/radius; active vs idle handled inline by callers.
	const pillBase =
		'rounded-[var(--gw-radius-full)] px-[var(--gw-space-3)] py-[var(--gw-space-1)] ' +
		'text-[var(--gw-text-xs)] font-medium transition-colors duration-[var(--gw-duration-fast)] ' +
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gw-color-primary-focus)] focus-visible:ring-offset-1';
	const pillActive = 'preset-tonal-primary text-[var(--gw-color-primary)]';
	const pillIdle = 'text-[var(--gw-color-text-muted)] hover:bg-[var(--gw-color-surface-3)] hover:text-[var(--gw-color-text)]';
	// Native select styling matching the Input primitive.
	const nativeField =
		'w-full transition-[border-color,box-shadow] duration-[var(--gw-duration-fast)] ' +
		'hover:border-[var(--gw-color-primary)] focus-visible:border-[var(--gw-color-primary)] ' +
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gw-color-primary-focus)]/30';
	// Card frame wrapping a data table.
	// No `overflow` here: it would force `overflow-y: auto` and clip the absolutely
	// positioned skills hover popover (and add a spurious scrollbar). Skeleton's
	// `.table` is width:100%, so it never needs horizontal scrolling.
	const tableCard =
		'rounded-[var(--gw-radius-lg)] border border-[var(--gw-color-border-subtle)] bg-[var(--gw-color-surface)]';
</script>

<div class="grid grid-cols-1 items-start gap-[var(--gw-space-4)] lg:grid-cols-[1fr_18rem]">
	<div class="space-y-[var(--gw-space-4)]">
		<header class="flex items-center justify-between">
			<h1 class="text-[var(--gw-text-2xl)] font-semibold tracking-tight text-[var(--gw-color-text)]">
				Orchestration
			</h1>
		</header>

		<nav class="flex gap-[var(--gw-space-1)] border-b border-[var(--gw-color-border-subtle)]" aria-label="Orchestration views">
			{#each TABS as t (t.id)}
				{@const active = tab === t.id}
				<button
					aria-current={active ? 'page' : undefined}
					class="relative -mb-px border-b-2 px-[var(--gw-space-3)] py-[var(--gw-space-2)]
						text-[var(--gw-text-sm)] transition-colors duration-[var(--gw-duration-fast)]
						focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gw-color-primary-focus)] focus-visible:ring-offset-1
						{active
							? 'border-[var(--gw-color-primary)] font-medium text-[var(--gw-color-primary)]'
							: 'border-transparent text-[var(--gw-color-text-muted)] hover:text-[var(--gw-color-text)]'}"
					onclick={() => (tab = t.id)}
				>
					{t.label}
					<span class="text-[var(--gw-color-text-muted)]">({t.count})</span>
				</button>
			{/each}
		</nav>

		{#if error}<Alert variant="error">{error}</Alert>{/if}

		{#if tab === 'sessions'}
			{#if data.errors.agents}<Alert variant="error">{data.errors.agents}</Alert>{/if}
			{#if canAgent}
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
			{/if}
			<!-- State filter pills -->
			<div class="flex items-center gap-[var(--gw-space-1)]">
				{#each ([['active', 'Active'], ['all', 'All'], ['done', 'Ended']] as const) as [id, label] (id)}
					<button class="{pillBase} {sessionFilter === id ? pillActive : pillIdle}" onclick={() => (sessionFilter = id)}>
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
				<div class={tableCard}>
				<table class="table">
					<thead>
						<tr><th>Session</th><th>Rig</th><th>Role</th><th>Crew</th><th>Skills</th><th>Hooks</th><th>State</th><th></th></tr>
					</thead>
					<tbody>
						{#each sessions as s (s.id)}
							{@const cfg = agentSkills(s)}
							<tr>
								<td class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)]">{s.id}</td>
								<td>{rigOf(s.rig)}</td>
								<td>
									<span class="flex items-center gap-1">
										{s.role}
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
								<td><Badge variant={stateVariant(s.state)}>{s.state}</Badge></td>
								<td>
									<div class="flex flex-nowrap items-center justify-end gap-1 whitespace-nowrap">
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
			{/if}
		{:else if tab === 'merge'}
			{#if data.errors.merges}<Alert variant="error">{data.errors.merges}</Alert>{/if}
			<!-- Merge filter pills -->
			<div class="flex items-center gap-[var(--gw-space-1)]">
				{#each ([['active', 'Active'], ['all', 'All']] as const) as [id, label] (id)}
					<button class="{pillBase} {mergeFilter === id ? pillActive : pillIdle}" onclick={() => (mergeFilter = id)}>
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
				<div class={tableCard}>
				<table class="table">
					<thead>
						<tr><th>Bead</th><th>Branch</th><th>State</th><th></th></tr>
					</thead>
					<tbody>
						{#each merges as m (m.bead)}
							<tr>
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
			{/if}
		{:else if tab === 'convoy'}
			{#if data.errors.convoys}<Alert variant="error">{data.errors.convoys}</Alert>{/if}
			<!-- Convoy filter pills -->
			<div class="flex items-center gap-[var(--gw-space-1)]">
				{#each ([['active', 'Active'], ['all', 'All']] as const) as [id, label] (id)}
					<button class="{pillBase} {convoyFilter === id ? pillActive : pillIdle}" onclick={() => (convoyFilter = id)}>
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
				<div class="space-y-[var(--gw-space-3)]">
					{#each convoys as c (c.id)}
						<div class="rounded-[var(--gw-radius-lg)] border border-[var(--gw-color-border-subtle)] bg-[var(--gw-color-surface)] p-[var(--gw-space-3)]">
							<header class="mb-[var(--gw-space-2)] flex items-center gap-[var(--gw-space-2)]">
								<span class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-sm)]">{c.id}</span>
								<Badge variant={stateVariant(c.state)}>{c.state}</Badge>
							</header>
							<table class="table">
								<tbody>
									{#each c.members as m (m.bead)}
										<tr>
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
					{/each}
				</div>
			{/if}
		{:else}
			{#if data.errors.quotas}<Alert variant="error">{data.errors.quotas}</Alert>{/if}

			<!-- hq-quota-ws-accounts.3: assign accounts from the deploy-global pool to THIS workspace.
			     /admin/quota administers the pool itself (onboard/retire). -->
			{#if canQuota && unassigned.length > 0}
				<div class="space-y-[var(--gw-space-2)]">
					<h2 class="text-[var(--gw-text-sm)] font-semibold text-[var(--gw-color-text)]">
						Available accounts <span class="text-[var(--gw-color-text-muted)]">({unassigned.length})</span>
					</h2>
					<div class="flex flex-wrap gap-[var(--gw-space-2)]">
						{#each unassigned as a (a.id)}
							<span class="flex items-center gap-[var(--gw-space-2)] rounded-[var(--gw-radius-md)] preset-tonal-surface px-[var(--gw-space-2)] py-[var(--gw-space-1)] text-[var(--gw-text-sm)]">
								<span class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)]">{a.id}</span>
								<Button variant="tonal" disabled={busy} onclick={() => run(() => o.assignAccount(a.id))}>Assign</Button>
							</span>
						{/each}
					</div>
				</div>
			{/if}

			<h2 class="text-[var(--gw-text-sm)] font-semibold text-[var(--gw-color-text)]">
				Assigned to this workspace <span class="text-[var(--gw-color-text-muted)]">({data.quotas.length})</span>
			</h2>
			{#if data.quotas.length === 0}
				<EmptyState
					icon="◷"
					title="Sin cuentas de cuota"
					description="Este workspace no tiene cuentas asignadas. Asigna una del pool de arriba."
				/>
			{:else}
				<div class={tableCard}>
				<table class="table">
					<thead>
						<tr><th>Account</th><th>Status</th><th>Window</th><th>5h Consumed / Limit</th><th>Weekly Consumed / Limit</th><th></th></tr>
					</thead>
					<tbody>
						{#each data.quotas as a (a.id)}
							<tr>
								<td class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)]">{a.id}</td>
								<td><Badge variant={stateVariant(a.status)}>{a.status}</Badge></td>
								<td>{a.window?.kind ?? '—'}</td>
								<td>{a.window ? `${Math.ceil(a.window.consumed)} / ${a.window.limit}` : '—'}</td>
								<td>{a.weekly_window ? `${Math.ceil(a.weekly_window.consumed)} / ${a.weekly_window.limit}` : '—'}</td>
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
			{/if}
		{/if}
	</div>

	<LiveFeed />
</div>
