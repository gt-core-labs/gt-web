<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { hasScope } from '$lib/api/auth';
	import { Badge, Button, Card } from '$lib/ui';
	import CreateDocModal from '$lib/components/knowledge/CreateDocModal.svelte';
	import {
		browserSkills,
		EFFORT_LEVELS,
		PERMISSION_MODES,
		type ModelConfig,
		type RegisterSkillBody
	} from '$lib/api/knowledge';
	import { TrackerError } from '$lib/api/tracker';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const canWrite = $derived(hasScope(data.user?.scopes, 'documents.write'));
	const canWriteSkills = $derived(hasScope(data.user?.scopes, 'skills.write'));
	let showCreate = $state(false);

	// The agent roles a skill can be bound to (hq-role-skills-term.2). A role = its enabled skills.
	const ROLES = ['mayor', 'polecat', 'witness', 'refinery', 'deacon', 'overseer', 'sheriff', 'dog'];

	// Skill registration (hq-agent-observability.7) + SKILL.md body (.1). The new skill rides the
	// skills event log, so a refresh re-pulls the SSR list.
	let newSkill = $state<RegisterSkillBody & { default_scopes_csv: string }>({
		skill: '',
		label: '',
		description: '',
		default_scopes_csv: '',
		body: ''
	});
	let skillError = $state('');
	let busy = $state(false);

	// Per-role enabled-skill sets, from the SSR bindings (hq-role-skills-term.2).
	const roleSkills = $derived(
		new Map(data.bindings.map((b) => [b.role, new Set(b.enabled_skills)]))
	);
	const hasSkill = (role: string, skill: string) => roleSkills.get(role)?.has(skill) ?? false;

	async function run(fn: () => Promise<unknown>) {
		skillError = '';
		busy = true;
		try {
			await fn();
			await invalidateAll();
		} catch (err) {
			skillError = err instanceof TrackerError ? `${err.status}: ${err.message}` : String(err);
		} finally {
			busy = false;
		}
	}

	async function registerSkill(e: SubmitEvent) {
		e.preventDefault();
		await run(async () => {
			await browserSkills().register({
				skill: newSkill.skill.trim(),
				label: newSkill.label.trim(),
				description: newSkill.description?.trim() || '',
				default_scopes: newSkill.default_scopes_csv
					.split(',')
					.map((s) => s.trim())
					.filter(Boolean),
				body: newSkill.body?.trim() || ''
			});
			newSkill = { skill: '', label: '', description: '', default_scopes_csv: '', body: '' };
		});
	}

	const retireSkill = (id: string) => run(() => browserSkills().retire(id));

	// Per-skill expand (show SKILL.md body + roles) and inline edit (hq-skills-edit.2).
	let expanded = $state<Record<string, boolean>>({});
	const toggleExpand = (id: string) => (expanded[id] = !expanded[id]);
	let editing = $state<string | null>(null);
	let editForm = $state<{ label: string; description: string; body: string }>({
		label: '',
		description: '',
		body: ''
	});
	function startEdit(s: { id: string; label: string; description: string; body?: string }) {
		editing = s.id;
		editForm = { label: s.label, description: s.description, body: s.body ?? '' };
	}
	const saveEdit = (id: string) =>
		run(async () => {
			await browserSkills().update(id, editForm);
			editing = null;
		});

	const toggleRole = (skill: string, role: string) =>
		run(() =>
			hasSkill(role, skill)
				? browserSkills().disableForRole(skill, role)
				: browserSkills().enableForRole(skill, role)
		);

	// Role prompts (hq-role-skills-term.4): seeded from the SSR bindings, editable per role.
	let rolePrompts = $state<Record<string, string>>({});
	$effect(() => {
		const seed: Record<string, string> = {};
		for (const b of data.bindings) seed[b.role] = b.prompt ?? '';
		rolePrompts = seed;
	});
	const saveRolePrompt = (role: string) =>
		run(() => browserSkills().setRolePrompt(role, rolePrompts[role] ?? ''));

	// Role model config (hq-role-model.1): seeded from the SSR bindings, editable per role. An empty
	// model/mode/effort clears the config (the role rides the account default).
	const MODELS = ['', 'opus', 'sonnet', 'haiku'];
	const blankModel = (): ModelConfig => ({ model: '', permission_mode: '', effort: '' });
	let roleModels = $state<Record<string, ModelConfig>>({});
	$effect(() => {
		const seed: Record<string, ModelConfig> = {};
		for (const b of data.bindings) seed[b.role] = b.model_config ?? blankModel();
		roleModels = seed;
	});
	const saveRoleModel = (role: string) =>
		run(() => browserSkills().setRoleModel(role, roleModels[role] ?? blankModel()));

	type Tab = 'documents' | 'skills' | 'prompts' | 'models' | 'feed';
	let tab = $state<Tab>('documents');
	const TABS: { id: Tab; label: string }[] = [
		{ id: 'documents', label: 'Documents' },
		{ id: 'skills', label: 'Skills' },
		{ id: 'prompts', label: 'Prompts' },
		{ id: 'models', label: 'Models' },
		{ id: 'feed', label: 'Feed' }
	];
</script>

<div class="space-y-4">
	<header class="flex items-center justify-between">
		<h1 class="h2">Knowledge</h1>
		{#if canWrite && tab === 'documents'}
			<Button onclick={() => (showCreate = true)}>New document</Button>
		{/if}
	</header>

	<nav class="flex gap-1 border-b border-surface-500/20">
		{#each TABS as t (t.id)}
			<button
				class="px-3 py-2 text-sm"
				class:border-b-2={tab === t.id}
				class:border-primary-500={tab === t.id}
				class:opacity-60={tab !== t.id}
				onclick={() => (tab = t.id)}
			>
				{t.label}
			</button>
		{/each}
	</nav>

	{#if tab === 'documents'}
		<form method="GET" class="flex gap-2">
			<input class="input" type="search" name="q" value={data.q} placeholder="Search documents (full-text / hybrid)…" />
			<Button type="submit">Search</Button>
		</form>

		{#if data.docError}<p class="text-sm text-error-500">{data.docError}</p>{/if}

		{#if data.results.length === 0}
			<p class="opacity-60">{data.q ? `No documents match “${data.q}”.` : 'No documents yet.'}</p>
		{:else}
			{#if !data.q}<p class="text-sm opacity-50">Recent documents</p>{/if}
			<ul class="space-y-2">
				{#each data.results as doc (doc.id)}
					<li>
						<a href={`/knowledge/${doc.id}`} class="block">
							<Card>
								<div class="flex items-center justify-between gap-2">
									<span class="font-medium">{doc.filename}</span>
									<Badge variant="surface">{doc.kind}</Badge>
								</div>
								<div class="text-xs opacity-60">{doc.owner_type}:{doc.owner_id} · v{doc.version}</div>
								{#if doc.body_md || doc.extracted_text}
									<p class="mt-1 line-clamp-2 text-sm opacity-70">
										{(doc.body_md ?? doc.extracted_text ?? '').slice(0, 200)}
									</p>
								{/if}
							</Card>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	{:else if tab === 'skills'}
		{#if data.skillsError}<p class="text-sm text-error-500">{data.skillsError}</p>{/if}
		{#if skillError}<p class="text-sm text-error-500">{skillError}</p>{/if}
		{#if canWriteSkills}
			<form class="flex flex-col gap-2 rounded border border-surface-500/20 p-3" onsubmit={registerSkill}>
				<div class="flex flex-wrap items-end gap-2">
					<input class="input w-40" placeholder="id (graphify)" bind:value={newSkill.skill} required />
					<input class="input w-40" placeholder="label" bind:value={newSkill.label} required />
					<input class="input flex-1" placeholder="description" bind:value={newSkill.description} />
					<input
						class="input w-56"
						placeholder="scopes (graph.read, …)"
						bind:value={newSkill.default_scopes_csv}
					/>
				</div>
				<textarea
					class="textarea font-mono text-xs"
					rows="4"
					placeholder="SKILL.md body — the definition claude loads for the role…"
					bind:value={newSkill.body}
				></textarea>
				<div><Button type="submit" disabled={busy}>Register skill</Button></div>
			</form>
		{/if}
		{#if data.skills.length === 0}
			<p class="opacity-60">No skills registered.</p>
		{:else}
			<ul class="space-y-2">
				{#each data.skills as s (s.id)}
					{@const enabledRoles = ROLES.filter((r) => hasSkill(r, s.id)).length}
					<li>
						<Card>
							<!-- Compact header: label · description · actions. Roles/body collapse under Ver. -->
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2">
										<span class="font-medium">{s.label}</span>
										<span class="font-mono text-xs opacity-50">{s.id}</span>
										{#if s.body}<Badge variant="success">SKILL.md</Badge>{/if}
										{#if enabledRoles > 0}<Badge variant="primary">{enabledRoles} roles</Badge>{/if}
									</div>
									<p class="mt-0.5 line-clamp-1 text-sm opacity-70">{s.description || '—'}</p>
								</div>
								<div class="flex shrink-0 items-center gap-1">
									<Button variant="tonal" onclick={() => toggleExpand(s.id)}>
										{expanded[s.id] ? 'Ocultar' : 'Ver'}
									</Button>
									{#if canWriteSkills}
										<Button variant="tonal" onclick={() => startEdit(s)}>Editar</Button>
										<button
											class="px-1 text-error-500 hover:underline"
											title="Retire skill"
											onclick={() => retireSkill(s.id)}>✕</button
										>
									{/if}
								</div>
							</div>

							{#if editing === s.id}
								<!-- Inline edit (hq-skills-edit.2): label/description/SKILL.md body. -->
								<div class="mt-3 space-y-2 border-t border-surface-500/10 pt-3">
									<input class="input w-full" placeholder="label" bind:value={editForm.label} />
									<input class="input w-full" placeholder="description" bind:value={editForm.description} />
									<textarea class="textarea font-mono text-xs" rows="8" placeholder="SKILL.md body" bind:value={editForm.body}></textarea>
									<div class="flex gap-2">
										<Button disabled={busy} onclick={() => saveEdit(s.id)}>Save</Button>
										<Button variant="tonal" onclick={() => (editing = null)}>Cancel</Button>
									</div>
								</div>
							{:else if expanded[s.id]}
								<div class="mt-3 space-y-2 border-t border-surface-500/10 pt-3">
									{#if s.default_scopes.length}
										<div class="flex flex-wrap gap-1">
											{#each s.default_scopes as sc (sc)}<Badge variant="surface">{sc}</Badge>{/each}
										</div>
									{/if}
									{#if s.body}
										<pre class="max-h-64 overflow-auto rounded bg-surface-200-800 p-2 text-xs whitespace-pre-wrap">{s.body}</pre>
									{:else}
										<p class="text-xs opacity-50">No SKILL.md body.</p>
									{/if}
									{#if canWriteSkills}
										<div class="flex flex-wrap items-center gap-1">
											<span class="text-[10px] uppercase opacity-40">roles</span>
											{#each ROLES as role (role)}
												<button
													type="button"
													class="rounded border px-1.5 py-0.5 text-[10px]"
													class:preset-tonal-primary={hasSkill(role, s.id)}
													class:border-primary-500={hasSkill(role, s.id)}
													class:border-surface-500={!hasSkill(role, s.id)}
													class:opacity-50={!hasSkill(role, s.id)}
													disabled={busy}
													onclick={() => toggleRole(s.id, role)}
												>
													{role}
												</button>
											{/each}
										</div>
									{/if}
								</div>
							{/if}
						</Card>
					</li>
				{/each}
			</ul>
		{/if}
	{:else if tab === 'prompts'}
		{#if data.skillsError}<p class="text-sm text-error-500">{data.skillsError}</p>{/if}
		{#if skillError}<p class="text-sm text-error-500">{skillError}</p>{/if}
		<p class="text-sm opacity-60">
			The system prompt a role's terminal loads as <code>CLAUDE.md</code> (hq-role-skills-term.4).
		</p>
		{#if canWriteSkills}
			<div class="grid grid-cols-2 gap-2">
				{#each ROLES as role (role)}
					<div class="rounded border border-surface-500/20 p-2">
						<div class="mb-1 flex items-center justify-between">
							<span class="font-mono text-xs">{role}</span>
							<Button type="button" disabled={busy} onclick={() => saveRolePrompt(role)}>Save</Button>
						</div>
						<textarea
							class="textarea text-xs"
							rows="4"
							placeholder="prompt for {role}…"
							bind:value={rolePrompts[role]}
						></textarea>
					</div>
				{/each}
			</div>
		{:else}
			<p class="opacity-60">Need <code>skills.write</code> to edit role prompts.</p>
		{/if}
	{:else if tab === 'models'}
		{#if data.skillsError}<p class="text-sm text-error-500">{data.skillsError}</p>{/if}
		{#if skillError}<p class="text-sm text-error-500">{skillError}</p>{/if}
		<p class="text-sm opacity-60">
			The model config a role's session launches <code>claude</code> with (hq-role-model.1):
			<code>--model</code>, <code>--permission-mode</code>, and <code>--effort</code>. Leave a field
			blank to fall back to the account default.
		</p>
		{#if canWriteSkills}
			<div class="grid grid-cols-2 gap-2">
				{#each ROLES as role (role)}
					{#if roleModels[role]}
						<div class="rounded border border-surface-500/20 p-2">
							<div class="mb-2 flex items-center justify-between">
								<span class="font-mono text-xs">{role}</span>
								<Button type="button" disabled={busy} onclick={() => saveRoleModel(role)}>Save</Button>
							</div>
							<div class="grid grid-cols-3 gap-2">
								<label class="text-xs">
									<span class="opacity-60">Model</span>
									<select class="select text-xs" bind:value={roleModels[role].model}>
										{#each MODELS as m (m)}
											<option value={m}>{m === '' ? 'default' : m}</option>
										{/each}
									</select>
								</label>
								<label class="text-xs">
									<span class="opacity-60">Permission</span>
									<select class="select text-xs" bind:value={roleModels[role].permission_mode}>
										<option value="">unset</option>
										{#each PERMISSION_MODES as pm (pm)}
											<option value={pm}>{pm}</option>
										{/each}
									</select>
								</label>
								<label class="text-xs">
									<span class="opacity-60">Effort</span>
									<select class="select text-xs" bind:value={roleModels[role].effort}>
										<option value="">default</option>
										{#each EFFORT_LEVELS as e (e)}
											<option value={e}>{e}</option>
										{/each}
									</select>
								</label>
							</div>
						</div>
					{/if}
				{/each}
			</div>
		{:else}
			<p class="opacity-60">Need <code>skills.write</code> to edit role model config.</p>
		{/if}
	{:else}
		{#if data.feedError}<p class="text-sm text-error-500">{data.feedError}</p>{/if}
		{#if data.feed.length === 0}
			<p class="opacity-60">No recent events.</p>
		{:else}
			<ul class="space-y-1 text-sm">
				{#each data.feed as e (e.event_id)}
					<li class="flex items-center gap-2">
						<Badge variant="primary">{e.kind}</Badge>
						<span class="opacity-60">{new Date(e.ts).toLocaleString()}</span>
						<span class="truncate font-mono text-xs opacity-50">{e.correlation_id}</span>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>

{#if showCreate}
	<CreateDocModal createdBy={data.user?.sub ?? 'gt-web'} onclose={() => (showCreate = false)} />
{/if}
