<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { hasScope } from '$lib/api/auth';
	import { Badge, Button } from '$lib/ui';
	import { Markdown } from '$lib/components/ui';
	import {
		browserSkills,
		EFFORT_LEVELS,
		PERMISSION_MODES,
		type ModelConfig,
		type SkillBinding
	} from '$lib/api/knowledge';
	import { TrackerError } from '$lib/api/tracker';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const canWrite = $derived(hasScope(data.user?.scopes, 'skills.write'));

	// The agent roles you compose (hq-agent-provisioning.4). 'Agents' = the role TEMPLATE; live
	// sessions live under Orchestration.
	const ROLES = ['polecat', 'mayor', 'sheriff', 'deacon', 'refinery', 'witness', 'dog', 'overseer'];
	let role = $state('polecat');

	// Per-role enabled-skill sets, from the SSR bindings (hq-role-skills-term.2).
	const roleSkills = $derived(
		new Map(data.bindings.map((b) => [b.role, new Set(b.enabled_skills)]))
	);
	const hasSkill = (r: string, skill: string) => roleSkills.get(r)?.has(skill) ?? false;
	const skillCount = (r: string) => roleSkills.get(r)?.size ?? 0;

	let busy = $state(false);
	let err = $state('');
	async function run(fn: () => Promise<unknown>) {
		err = '';
		busy = true;
		try {
			await fn();
			await invalidateAll();
		} catch (e) {
			err = e instanceof TrackerError ? `${e.status}: ${e.message}` : String(e);
		} finally {
			busy = false;
		}
	}

	// ── Skills (knowledge) ──────────────────────────────────────────────
	const toggleSkill = (skill: string) =>
		run(() =>
			hasSkill(role, skill)
				? browserSkills().disableForRole(skill, role)
				: browserSkills().enableForRole(skill, role)
		);

	// ── Prompt (knowledge) ──────────────────────────────────────────────
	let prompts = $state<Record<string, string>>({});
	$effect(() => {
		const seed: Record<string, string> = {};
		for (const b of data.bindings) seed[b.role] = b.prompt ?? '';
		prompts = seed;
	});
	let promptEditing = $state(false);
	const savePrompt = () =>
		run(async () => {
			await browserSkills().setRolePrompt(role, prompts[role] ?? '');
			promptEditing = false;
		});

	// ── Model (execution) ───────────────────────────────────────────────
	const MODELS = ['', 'opus', 'sonnet', 'haiku'];
	const blankModel = (): ModelConfig => ({ model: '', permission_mode: '', effort: '' });
	let models = $state<Record<string, ModelConfig>>({});
	$effect(() => {
		// Seed EVERY role (gtweb-c7ba4b): a role without a binding yet still renders the picker
		// (all-default) instead of the section vanishing behind `{#if models[role]}`.
		const byRole = new Map(data.bindings.map((b) => [b.role, b.model_config]));
		const seed: Record<string, ModelConfig> = {};
		for (const r of ROLES) seed[r] = byRole.get(r) ?? blankModel();
		models = seed;
	});

	// Pill pickers with immediate save (gtweb-c7ba4b): mirrors the Skills toggles — click a pill,
	// the PUT lands, invalidateAll reseeds from the server truth, and the chosen pill STAYS
	// highlighted. No separate Save button whose reseed made the dropdowns look like they "jumped".
	type ModelField = keyof ModelConfig;
	const MODEL_PICKERS: {
		field: ModelField;
		label: string;
		hint?: string;
		options: { value: string; label: string }[];
	}[] = [
		{
			field: 'model',
			label: 'Model',
			options: MODELS.map((m) => ({ value: m, label: m || 'default' }))
		},
		{
			field: 'permission_mode',
			label: 'Permission',
			hint: 'interactive sessions only — autonomous agents always keep bypass (hq-e90522)',
			options: [{ value: '', label: 'unset' }, ...PERMISSION_MODES.map((m) => ({ value: m, label: m }))]
		},
		{
			field: 'effort',
			label: 'Effort',
			options: [{ value: '', label: 'default' }, ...EFFORT_LEVELS.map((e) => ({ value: e, label: e }))]
		}
	];
	const modelFieldOn = (field: ModelField, value: string) =>
		(models[role]?.[field] ?? '') === value;
	const setModelField = (field: ModelField, value: string) =>
		run(async () => {
			const next = { ...(models[role] ?? blankModel()), [field]: value };
			models = { ...models, [role]: next };
			await browserSkills().setRoleModel(role, next);
		});

	// ── Scopes (permissions, hq-role-scopes) ────────────────────────────
	// The grantable catalog feeds the picker (no free text). When it's unavailable the editor
	// degrades to a validated free-text fallback.
	const catalog = $derived(data.scopeCatalog ?? []);
	const catalogByNs = $derived.by(() => {
		const m = new Map<string, { scope: string; label: string }[]>();
		for (const e of catalog) {
			if (!m.has(e.namespace)) m.set(e.namespace, []);
			m.get(e.namespace)!.push({ scope: e.scope, label: e.label });
		}
		return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
	});

	// Picked scopes per role (checkbox mode), seeded from the binding's own scopes.
	let scopesByRole = $state<Record<string, Set<string>>>({});
	$effect(() => {
		const seed: Record<string, Set<string>> = {};
		for (const b of data.bindings) seed[b.role] = new Set(b.scopes ?? []);
		scopesByRole = seed;
	});
	const scopeOn = (sc: string) => scopesByRole[role]?.has(sc) ?? false;
	function toggleScope(sc: string) {
		const cur = new Set(scopesByRole[role] ?? []);
		if (cur.has(sc)) cur.delete(sc);
		else cur.add(sc);
		scopesByRole = { ...scopesByRole, [role]: cur };
	}
	const saveScopes = () =>
		run(() => browserSkills().setRoleScopes(role, [...(scopesByRole[role] ?? [])]));

	// Free-text fallback (catalog unavailable): a space/comma-separated scope list.
	let scopesText = $state<Record<string, string>>({});
	$effect(() => {
		const seed: Record<string, string> = {};
		for (const b of data.bindings) seed[b.role] = (b.scopes ?? []).join(' ');
		scopesText = seed;
	});
	const saveScopesText = () =>
		run(() =>
			browserSkills().setRoleScopes(
				role,
				(scopesText[role] ?? '')
					.split(/[\s,]+/)
					.map((s) => s.trim())
					.filter(Boolean)
			)
		);

	// The library, grouped so the Skills toggles read like the Knowledge library.
	const library = $derived(
		[...data.skills].sort((a, b) => (a.group || '').localeCompare(b.group || '') || a.id.localeCompare(b.id))
	);

	type Section = 'skills' | 'prompt' | 'model' | 'scopes';
	let section = $state<Section>('skills');
	const SECTIONS: { id: Section; label: string }[] = [
		{ id: 'skills', label: 'Skills' },
		{ id: 'prompt', label: 'Prompt' },
		{ id: 'model', label: 'Model' },
		{ id: 'scopes', label: 'Scopes' }
	];
</script>

<style>
	@keyframes fade-up-in {
		from { opacity: 0; transform: translateY(8px); }
		to   { opacity: 1; transform: translateY(0); }
	}
	.entry   { animation: fade-up-in 480ms cubic-bezier(0.32, 0.72, 0, 1) both; }
	.entry-1 { animation-delay: 0ms; }
	.entry-2 { animation-delay: 55ms; }
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
</style>

<div class="space-y-5">
	<!-- ── Header ────────────────────────────────────────────────────── -->
	<header class="entry entry-1 space-y-2">
		<span
			class="inline-flex items-center rounded-full border border-[var(--gw-color-border-subtle)]
				bg-[var(--gw-color-surface-3)] px-[var(--gw-space-3)] py-[3px]
				text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--gw-color-text-muted)]"
		>
			Agent Composition
		</span>
		<h1
			class="text-[var(--gw-text-3xl)] font-semibold leading-[var(--gw-leading-tight)]
				tracking-tight text-[var(--gw-color-text)]"
		>
			Agents
		</h1>
		<p class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">
			Assemble each role from the Knowledge library plus its own settings: skills, prompt, model,
			and MCP scopes. Knowledge stays the library; this is the per-role template.
		</p>
	</header>

	{#if data.skillsError}
		<p class="text-[var(--gw-text-sm)] text-[var(--gw-color-error)]">{data.skillsError}</p>
	{/if}
	{#if err}
		<p class="text-[var(--gw-text-sm)] text-[var(--gw-color-error)]">{err}</p>
	{/if}

	<div class="entry entry-2 grid grid-cols-1 gap-[var(--gw-space-4)] lg:grid-cols-[200px_1fr]">
		<!-- ── Role list ─────────────────────────────────────────────── -->
		<nav class="bezel h-max" aria-label="Roles">
			<div class="bezel-core flex flex-col gap-[3px] p-[3px]">
				{#each ROLES as r (r)}
					{@const active = role === r}
					<button
						type="button"
						aria-current={active ? 'page' : undefined}
						class="flex items-center justify-between gap-2 rounded-[calc(var(--gw-radius-xl)-3px)]
							px-[var(--gw-space-3)] py-[var(--gw-space-2)] text-left text-[var(--gw-text-sm)]
							transition-all duration-[160ms] ease-[cubic-bezier(0.32,0.72,0,1)]
							focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gw-color-primary-focus)]
							{active
								? 'bg-[var(--gw-color-primary)] font-medium text-white shadow-sm'
								: 'text-[var(--gw-color-text-muted)] hover:bg-[var(--gw-color-surface-3)] hover:text-[var(--gw-color-text)]'}"
						onclick={() => (role = r)}
					>
						<span class="font-[family-name:var(--gw-font-mono)]">{r}</span>
						<span class="tabular-nums text-[10px] opacity-60">{skillCount(r)}</span>
					</button>
				{/each}
			</div>
		</nav>

		<!-- ── Selected role detail ──────────────────────────────────── -->
		<section class="space-y-[var(--gw-space-4)]">
			<!-- Section tabs -->
			<nav
				class="grid grid-cols-4 gap-[3px] rounded-[var(--gw-radius-xl)]
					bg-[var(--gw-color-surface-3)] p-[3px] ring-1 ring-[var(--gw-color-border-subtle)]"
				aria-label="Role config sections"
			>
				{#each SECTIONS as s (s.id)}
					{@const active = section === s.id}
					<button
						type="button"
						aria-current={active ? 'page' : undefined}
						class="rounded-[calc(var(--gw-radius-xl)-3px)] py-[var(--gw-space-2)] text-center
							text-[var(--gw-text-xs)] font-medium transition-all duration-[200ms]
							ease-[cubic-bezier(0.32,0.72,0,1)] focus-visible:outline-none focus-visible:ring-2
							focus-visible:ring-[var(--gw-color-primary-focus)]
							{active
								? 'bg-[var(--gw-color-primary)] text-white shadow-sm'
								: 'text-[var(--gw-color-text-muted)] hover:text-[var(--gw-color-text)]'}"
						onclick={() => (section = s.id)}
					>
						{s.label}
					</button>
				{/each}
			</nav>

			{#if !canWrite}
				<p class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">
					Need <code class="font-[family-name:var(--gw-font-mono)]">skills.write</code> to edit role config.
				</p>
			{/if}

			<!-- ══ SKILLS ════════════════════════════════════════════════ -->
			{#if section === 'skills'}
				{#if library.length === 0}
					<p class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">
						No skills in the library. Author them in <a class="underline" href="/knowledge">Knowledge</a>.
					</p>
				{:else}
					<div class="bezel">
						<div class="bezel-core space-y-[var(--gw-space-2)] p-[var(--gw-space-4)]">
							<p class="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">
								Skills enabled for <span class="text-[var(--gw-color-text)]">{role}</span>
							</p>
							<div class="flex flex-wrap gap-1.5">
								{#each library as s (s.id)}
									<button
										type="button"
										disabled={busy || !canWrite}
										class="rounded-full border px-2.5 py-0.5 text-[11px] font-medium
											transition-all duration-[150ms] ease-[cubic-bezier(0.32,0.72,0,1)]
											disabled:opacity-50
											{hasSkill(role, s.id)
												? 'border-[var(--gw-color-primary)] bg-[var(--gw-color-primary-subtle)] text-[var(--gw-color-primary)]'
												: 'border-[var(--gw-color-border)] text-[var(--gw-color-text-muted)] hover:border-[var(--gw-color-primary)] hover:text-[var(--gw-color-primary)]'}"
										title={s.description || s.id}
										onclick={() => toggleSkill(s.id)}
									>
										{s.label || s.id}
									</button>
								{/each}
							</div>
						</div>
					</div>
				{/if}

			<!-- ══ PROMPT ════════════════════════════════════════════════ -->
			{:else if section === 'prompt'}
				<div class="bezel">
					<div class="bezel-core p-[var(--gw-space-4)]">
						<div class="mb-[var(--gw-space-3)] flex items-center justify-between">
							<p class="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">
								System prompt — written as the session's
								<code class="font-[family-name:var(--gw-font-mono)]">CLAUDE.md</code>
							</p>
							{#if canWrite}
								{#if promptEditing}
									<div class="flex shrink-0 items-center gap-1">
										<Button type="button" disabled={busy} onclick={savePrompt}>Save</Button>
										<Button
											type="button"
											variant="tonal"
											onclick={() => {
												prompts[role] = data.bindings.find((b) => b.role === role)?.prompt ?? '';
												promptEditing = false;
											}}
										>Cancel</Button>
									</div>
								{:else}
									<Button type="button" onclick={() => (promptEditing = true)}>Edit</Button>
								{/if}
							{/if}
						</div>
						{#if promptEditing}
							<textarea class="textarea text-xs" rows="10" placeholder="prompt for {role}…" bind:value={prompts[role]}></textarea>
						{:else if prompts[role]}
							<Markdown text={prompts[role]} />
						{:else}
							<p class="text-xs text-[var(--gw-color-text-muted)]">No prompt.</p>
						{/if}
					</div>
				</div>

			<!-- ══ MODEL ═════════════════════════════════════════════════ -->
			{:else if section === 'model'}
				<div class="bezel">
					<div class="bezel-core space-y-[var(--gw-space-3)] p-[var(--gw-space-4)]">
						<p class="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">
							Claude launch for <span class="text-[var(--gw-color-text)]">{role}</span> —
							<code class="font-[family-name:var(--gw-font-mono)]">--model</code> /
							<code class="font-[family-name:var(--gw-font-mono)]">--permission-mode</code> /
							<code class="font-[family-name:var(--gw-font-mono)]">--effort</code>.
							Click a pill to apply; the selection persists.
						</p>
						{#each MODEL_PICKERS as grp (grp.field)}
							<div>
								<p class="mb-1 text-xs text-[var(--gw-color-text-muted)]">
									{grp.label}{#if grp.hint}
										<span class="ml-1 opacity-70">({grp.hint})</span>
									{/if}
								</p>
								<div class="flex flex-wrap gap-1.5">
									{#each grp.options as opt (opt.value)}
										<button
											type="button"
											disabled={busy || !canWrite}
											aria-pressed={modelFieldOn(grp.field, opt.value)}
											class="rounded-full border px-2.5 py-0.5 text-[11px] font-medium
												transition-all duration-[150ms] ease-[cubic-bezier(0.32,0.72,0,1)]
												disabled:opacity-50
												{modelFieldOn(grp.field, opt.value)
													? 'border-[var(--gw-color-primary)] bg-[var(--gw-color-primary-subtle)] text-[var(--gw-color-primary)]'
													: 'border-[var(--gw-color-border)] text-[var(--gw-color-text-muted)] hover:border-[var(--gw-color-primary)] hover:text-[var(--gw-color-primary)]'}"
											onclick={() => setModelField(grp.field, opt.value)}
										>
											{opt.label}
										</button>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				</div>

			<!-- ══ SCOPES ════════════════════════════════════════════════ -->
			{:else}
				<div class="bezel">
					<div class="bezel-core p-[var(--gw-space-4)]">
						<div class="mb-[var(--gw-space-3)] flex items-center justify-between gap-2">
							<p class="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">
								MCP scopes for <span class="text-[var(--gw-color-text)]">{role}</span> — permission, decoupled from skills (hq-role-scopes)
							</p>
							{#if canWrite}
								<Button
									type="button"
									disabled={busy}
									onclick={catalog.length > 0 ? saveScopes : saveScopesText}
								>Save</Button>
							{/if}
						</div>

						{#if catalog.length > 0}
							<!-- Catalog-driven picker: only valid, grantable scopes (no free text). -->
							<div class="space-y-[var(--gw-space-3)]">
								{#each catalogByNs as [ns, entries] (ns)}
									<div>
										<p class="mb-1 font-[family-name:var(--gw-font-mono)] text-[10px] uppercase
											tracking-[0.12em] text-[var(--gw-color-text-muted)]">{ns}</p>
										<div class="flex flex-wrap gap-1.5">
											{#each entries as e (e.scope)}
												<button
													type="button"
													disabled={busy || !canWrite}
													class="rounded-full border px-2.5 py-0.5 text-[11px] font-medium
														transition-all duration-[150ms] ease-[cubic-bezier(0.32,0.72,0,1)]
														disabled:opacity-50
														{scopeOn(e.scope)
															? 'border-[var(--gw-color-primary)] bg-[var(--gw-color-primary-subtle)] text-[var(--gw-color-primary)]'
															: 'border-[var(--gw-color-border)] text-[var(--gw-color-text-muted)] hover:border-[var(--gw-color-primary)] hover:text-[var(--gw-color-primary)]'}"
													title={e.scope}
													onclick={() => toggleScope(e.scope)}
												>
													{e.label}
												</button>
											{/each}
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<!-- Catalog unavailable → validated free-text fallback (backend still gates the vocabulary). -->
							<p class="mb-2 text-xs text-[var(--gw-color-text-muted)]">
								Scope catalog unavailable — enter scopes as a space/comma-separated list
								(e.g. <code class="font-[family-name:var(--gw-font-mono)]">issues.read memory.write</code>).
							</p>
							<textarea
								class="textarea font-[family-name:var(--gw-font-mono)] text-xs"
								rows="3"
								placeholder="issues.read issues.write…"
								disabled={!canWrite}
								bind:value={scopesText[role]}
							></textarea>
						{/if}

						{#if (scopesByRole[role]?.size ?? 0) > 0 && catalog.length > 0}
							<div class="mt-[var(--gw-space-3)] flex flex-wrap gap-1 border-t border-[var(--gw-color-border-subtle)] pt-[var(--gw-space-3)]">
								<span class="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Granted</span>
								{#each [...scopesByRole[role]] as sc (sc)}<Badge variant="surface">{sc}</Badge>{/each}
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</section>
	</div>
</div>
