<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { base } from '$app/paths';
	import { hasScope } from '$lib/api/auth';
	import { Badge, Button } from '$lib/ui';
	import { Markdown } from '$lib/components/ui';
	import CreateDocModal from '$lib/components/knowledge/CreateDocModal.svelte';
	import { browserSkills, type RegisterSkillBody } from '$lib/api/knowledge';
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
		body: '',
		group: ''
	});
	let skillError = $state('');

	// Import from GitHub — two modes:
	//   single: owner/repo/path/SKILL.md  → fetch + pre-fill the form below.
	//   discover: owner/repo (no .md path) → GitHub API tree → checkboxes → batch register.
	let importSource = $state('');
	let importing = $state(false);
	let importError = $state('');

	// Discovered skills from a repo (discover mode).
	interface DiscoveredSkill {
		path: string;
		name: string;
		label: string;
		description: string;
		body: string;
		group: string;
		selected: boolean;
	}
	interface DiscoveredCategory {
		name: string;      // top-level dir (= natural group)
		count: number;
		paths: string[];
		selected: boolean;
	}
	let discovered = $state<DiscoveredSkill[]>([]);
	let categories = $state<DiscoveredCategory[]>([]);  // set when repo is large (multi-category)
	let discovering = $state(false);
	let loadingCategories = $state(false);

	function parseOwnerRepo(input: string): { owner: string; repo: string; rest: string } | null {
		const clean = input.replace(/^https?:\/\/github\.com\//, '').replace(/^https?:\/\/raw\.githubusercontent\.com\//, '');
		const parts = clean.split('/').filter(Boolean);
		if (parts.length < 2) return null;
		return { owner: parts[0], repo: parts[1].replace(/\.git$/, ''), rest: parts.slice(2).join('/') };
	}

	function toRawUrl(owner: string, repo: string, path: string, branch = 'HEAD'): string {
		return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
	}

	function parseSkillFrontmatter(text: string): { name: string; description: string } {
		const m = text.match(/^---\n([\s\S]*?)\n---/);
		if (!m) return { name: '', description: '' };
		const fm = m[1];
		const unquote = (s: string) => s.replace(/^["']|["']$/g, '');
		const name = unquote(fm.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? '');
		const description = unquote(fm.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? '');
		return { name, description };
	}

	// Fetch the GitHub tree and return SKILL.md paths grouped by top-level directory.
	async function fetchSkillTree(owner: string, repo: string): Promise<Map<string, string[]>> {
		const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`;
		const res = await fetch(apiUrl, { headers: { Accept: 'application/vnd.github+json' } });
		if (!res.ok) throw new Error(`GitHub API ${res.status}: ${res.statusText}`);
		const tree = await res.json() as { tree: { path: string; type: string }[] };
		const map = new Map<string, string[]>();
		for (const n of tree.tree) {
			if (n.type !== 'blob' || !/\/SKILL\.md$/i.test(n.path)) continue;
			const topDir = n.path.split('/')[0];
			if (!map.has(topDir)) map.set(topDir, []);
			map.get(topDir)!.push(n.path);
		}
		return map;
	}

	// Fetch SKILL.md files for the given paths and return DiscoveredSkill entries.
	async function fetchSkillFiles(owner: string, repo: string, paths: string[], group: string): Promise<DiscoveredSkill[]> {
		return Promise.all(paths.map(async (path) => {
			const rawRes = await fetch(toRawUrl(owner, repo, path));
			const text = rawRes.ok ? await rawRes.text() : '';
			const { name, description } = parseSkillFrontmatter(text);
			const parts = path.split('/');
			const stem = parts.length > 1 ? parts[parts.length - 2] : repo;
			return { path, name: name || stem, label: stem, description, body: text, group, selected: true };
		}));
	}

	async function handleImport() {
		importError = '';
		const parsed = parseOwnerRepo(importSource.trim());
		if (!parsed) { importError = 'Formato inválido — usa owner/repo o owner/repo/path/SKILL.md'; return; }
		const { owner, repo, rest } = parsed;

		if (rest.endsWith('.md') || rest.endsWith('.MD')) {
			// Single-file mode: fetch and pre-fill.
			importing = true;
			try {
				const res = await fetch(toRawUrl(owner, repo, rest || 'SKILL.md'));
				if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
				const text = await res.text();
				const { name, description } = parseSkillFrontmatter(text);
				if (name && !newSkill.skill) newSkill.skill = name;
				if (description && !newSkill.description) newSkill.description = description;
				if (!newSkill.label) newSkill.label = repo;
				newSkill.body = text;
				discovered = [];
				categories = [];
			} catch (err) { importError = String(err); }
			finally { importing = false; }
		} else {
			// Discover mode: fetch tree and decide between category-picker (large) or direct cards (small).
			discovering = true;
			discovered = [];
			categories = [];
			try {
				const treeMap = await fetchSkillTree(owner, repo);
				const totalSkills = [...treeMap.values()].reduce((s, p) => s + p.length, 0);
				if (totalSkills === 0) throw new Error('No se encontraron archivos SKILL.md en el repo');

				const LARGE_THRESHOLD = 30;
				if (totalSkills > LARGE_THRESHOLD) {
					// Large repo: show category picker first. Skip hidden dirs (e.g. .gemini).
					categories = [...treeMap.entries()]
						.filter(([dir]) => !dir.startsWith('.'))
						.map(([name, paths]) => ({ name, count: paths.length, paths, selected: false }))
						.sort((a, b) => b.count - a.count);
				} else {
					// Small repo: go straight to cards.
					const defaultGroup = (newSkill.group ?? '').trim() || repo;
					const allPaths = [...treeMap.values()].flat();
					discovered = await fetchSkillFiles(owner, repo, allPaths, defaultGroup);
				}
			} catch (err) { importError = String(err); }
			finally { discovering = false; }
		}
	}

	// Step 2 for large repos: load SKILL.md files for the selected categories.
	async function loadSelectedCategories() {
		const selected = categories.filter(c => c.selected);
		if (selected.length === 0) return;
		importError = '';
		loadingCategories = true;
		try {
			const parsed = parseOwnerRepo(importSource.trim())!;
			const { owner, repo } = parsed;
			const results = await Promise.all(
				selected.map(cat => fetchSkillFiles(owner, repo, cat.paths, cat.name))
			);
			discovered = results.flat();
			categories = [];
		} catch (err) { importError = String(err); }
		finally { loadingCategories = false; }
	}

	const allCategoriesSelected = $derived(categories.length > 0 && categories.every(c => c.selected));
	function toggleAllCategories() {
		const v = !allCategoriesSelected;
		categories = categories.map(c => ({ ...c, selected: v }));
	}

	const allSelected = $derived(discovered.length > 0 && discovered.every(d => d.selected));
	const missingGroup = $derived(discovered.some(d => d.selected && !d.group.trim()));
	function toggleAll() {
		const v = !allSelected;
		discovered = discovered.map(d => ({ ...d, selected: v }));
	}

	// Bulk-set the group for all discovered cards at once.
	function setGroupAll(g: string) {
		discovered = discovered.map(d => ({ ...d, group: g }));
	}

	// Role to assign after import; empty = register only, no enablement.
	let importRole = $state('');

	async function importSelected() {
		const toRegister = discovered.filter(d => d.selected);
		if (toRegister.length === 0) return;
		skillError = '';
		busy = true;
		try {
			for (const d of toRegister) {
				await browserSkills().register({
					skill: d.name,
					label: d.label,
					description: d.description,
					body: d.body,
					group: d.group || undefined
				});
				if (importRole) {
					await browserSkills().enableForRole(d.name, importRole);
				}
			}
			discovered = [];
			importSource = '';
			await invalidateAll();
		} catch (err) {
			skillError = err instanceof TrackerError ? `${err.status}: ${err.message}` : String(err);
		} finally { busy = false; }
	}
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

	async function deleteGroup(group: string, ids: string[]) {
		if (!confirm(`¿Eliminar las ${ids.length} skills del grupo "${group}"?`)) return;
		await run(() => Promise.all(ids.map((id) => browserSkills().retire(id))));
	}

	// Per-skill expand (show SKILL.md body + roles) and inline edit (hq-skills-edit.2).
	let expanded = $state<Record<string, boolean>>({});
	const toggleExpand = (id: string) => (expanded[id] = !expanded[id]);
	let editing = $state<string | null>(null);
	let editForm = $state<{ label: string; description: string; body: string; group: string }>({
		label: '',
		description: '',
		body: '',
		group: ''
	});
	function startEdit(s: { id: string; label: string; description: string; body?: string; group?: string }) {
		editing = s.id;
		editForm = { label: s.label, description: s.description, body: s.body ?? '', group: s.group ?? '' };
	}
	const saveEdit = (id: string) =>
		run(async () => {
			await browserSkills().update(id, editForm);
			editing = null;
		});

	// Per-role config (skill toggles, prompt, model, scopes) lives in the dedicated Agents page
	// (gtweb-agents-page) now — Knowledge is the library: authoring skills + docs. The role list here
	// stays only to (a) the import-time role assignment and (b) the read-only "N roles" badge.

	type Tab = 'documents' | 'skills' | 'feed';
	let tab = $state<Tab>('documents');
	const TABS: { id: Tab; label: string }[] = [
		{ id: 'documents', label: 'Documents' },
		{ id: 'skills', label: 'Skills' },
		{ id: 'feed', label: 'Feed' }
	];
</script>

<style>
	/* Entry animation — fade-up (no blur), distinct from Orchestration's slide-up-blur */
	@keyframes fade-up-in {
		from { opacity: 0; transform: translateY(8px); }
		to   { opacity: 1; transform: translateY(0); }
	}

	.entry   { animation: fade-up-in 480ms cubic-bezier(0.32, 0.72, 0, 1) both; }
	.entry-1 { animation-delay: 0ms; }
	.entry-2 { animation-delay: 55ms; }
	.entry-3 { animation-delay: 0ms; }
	.entry-4 { animation-delay: 60ms; }
	/* entry-5 reserved — not currently used */

	/* Double-Bezel — outer shell */
	.bezel {
		border-radius: var(--gw-radius-2xl);
		border: 1px solid var(--gw-color-border-subtle);
		background-color: var(--gw-color-surface-3);
		padding: 3px;
	}

	/* Double-Bezel — inner core */
	.bezel-core {
		border-radius: calc(var(--gw-radius-2xl) - 3px);
		background-color: var(--gw-color-surface);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
	}

	/* Double-Bezel — inner core with overflow clip (tables) */
	.bezel-core-overflow {
		border-radius: calc(var(--gw-radius-2xl) - 3px);
		background-color: var(--gw-color-surface);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
		overflow: hidden;
	}

	/* Document card hover lift — GPU-safe */
	.doc-card {
		transition: transform 220ms cubic-bezier(0.32, 0.72, 0, 1),
		            box-shadow 220ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.doc-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 12px 28px -6px rgba(0, 0, 0, 0.09),
		            0 4px 10px -4px rgba(0, 0, 0, 0.06);
	}

	/* Group separator horizontal rule */
	.group-rule {
		height: 1px;
		flex: 1;
		background-color: var(--gw-color-border-subtle);
	}

	/* Feed row hover */
	.feed-row {
		transition: background-color 160ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.feed-row:hover {
		background-color: var(--gw-color-surface-3);
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
			Knowledge Base
		</span>
		<div class="flex items-end justify-between gap-4">
			<h1
				class="text-[var(--gw-text-3xl)] font-semibold leading-[var(--gw-leading-tight)]
					tracking-tight text-[var(--gw-color-text)]"
			>
				Knowledge
			</h1>
			{#if canWrite && tab === 'documents'}
				<Button onclick={() => (showCreate = true)}>New document</Button>
			{/if}
		</div>
	</header>

	<!-- ── Full-width segmented tab control (inverted active) ────────── -->
	<nav
		class="entry entry-2 grid grid-cols-3 gap-[3px] rounded-[var(--gw-radius-xl)]
			bg-[var(--gw-color-surface-3)] p-[3px] ring-1 ring-[var(--gw-color-border-subtle)]"
		aria-label="Knowledge views"
	>
		{#each TABS as t (t.id)}
			{@const active = tab === t.id}
			<button
				aria-current={active ? 'page' : undefined}
				class="rounded-[calc(var(--gw-radius-xl)-3px)] py-[var(--gw-space-2)]
					text-center text-[var(--gw-text-xs)] font-medium
					transition-all duration-[200ms] ease-[cubic-bezier(0.32,0.72,0,1)]
					focus-visible:outline-none focus-visible:ring-2
					focus-visible:ring-[var(--gw-color-primary-focus)]
					{active
						? 'bg-[var(--gw-color-primary)] text-white shadow-sm'
						: 'text-[var(--gw-color-text-muted)] hover:text-[var(--gw-color-text)]'}"
				onclick={() => (tab = t.id)}
			>
				{t.label}
			</button>
		{/each}
	</nav>

	<!-- ══ DOCUMENTS ══════════════════════════════════════════════════════ -->
	{#if tab === 'documents'}

		<!-- Search — Double-Bezel -->
		<form method="GET" class="entry entry-3 bezel">
			<div class="bezel-core flex gap-[var(--gw-space-2)] p-[var(--gw-space-3)]">
				<input
					class="input flex-1"
					type="search"
					name="q"
					value={data.q}
					placeholder="Search documents (full-text / hybrid)…"
				/>
				<Button type="submit">Search</Button>
			</div>
		</form>

		{#if data.docError}
			<p class="text-[var(--gw-text-sm)] text-[var(--gw-color-error)]">{data.docError}</p>
		{/if}

		{#if data.results.length === 0}
			<p class="entry entry-4 text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">
				{data.q ? `No documents match "${data.q}".` : 'No documents yet.'}
			</p>
		{:else}
			<div class="entry entry-4">
				{#if !data.q}
					<p class="mb-[var(--gw-space-3)] text-[10px] font-semibold uppercase
						tracking-[0.14em] text-[var(--gw-color-text-muted)]">
						Recent documents
					</p>
				{/if}
				<ul class="space-y-[var(--gw-space-3)]">
					{#each data.results as doc (doc.id)}
						<li>
							<a
								href={`${base}/knowledge/${doc.id}`}
								class="block rounded-[var(--gw-radius-2xl)] outline-none
									focus-visible:ring-2 focus-visible:ring-[var(--gw-color-primary-focus)]"
							>
								<div class="bezel doc-card">
									<div class="bezel-core p-[var(--gw-space-4)]">
										<div class="flex items-start justify-between gap-3">
											<div class="min-w-0 flex-1">
												<div class="flex flex-wrap items-center gap-2">
													<span class="font-semibold text-[var(--gw-color-text)]">{doc.filename}</span>
													<Badge variant="surface">{doc.kind}</Badge>
												</div>
												<div class="mt-0.5 text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
													{doc.owner_type}:{doc.owner_id} · v{doc.version}
												</div>
												{#if doc.body_md || doc.extracted_text}
													<p class="mt-2 line-clamp-2 text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">
														{(doc.body_md ?? doc.extracted_text ?? '').slice(0, 200)}
													</p>
												{/if}
											</div>
										</div>
									</div>
								</div>
							</a>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

	<!-- ══ SKILLS ═════════════════════════════════════════════════════════ -->
	{:else if tab === 'skills'}
		{#if data.skillsError}
			<p class="text-[var(--gw-text-sm)] text-[var(--gw-color-error)]">{data.skillsError}</p>
		{/if}
		{#if skillError}
			<p class="text-[var(--gw-text-sm)] text-[var(--gw-color-error)]">{skillError}</p>
		{/if}

		{#if canWriteSkills}
			<!-- GitHub import — Double-Bezel -->
			<div class="entry entry-3 bezel">
				<div class="bezel-core p-[var(--gw-space-4)]">
					<p class="mb-[var(--gw-space-3)] text-[10px] font-semibold uppercase
						tracking-[0.12em] text-[var(--gw-color-text-muted)]">
						Import from GitHub
					</p>
					<div class="flex gap-[var(--gw-space-2)]">
						<input
							class="input flex-1 font-[family-name:var(--gw-font-mono)] text-xs"
							placeholder="owner/repo (discover)  o  owner/repo/path/SKILL.md (single)"
							bind:value={importSource}
						/>
						<input class="input w-28 text-xs" placeholder="group (opcional)" bind:value={newSkill.group} />
						<Button
							type="button"
							disabled={importing || discovering || !importSource}
							onclick={handleImport}
						>
							{importing || discovering ? '…' : 'Fetch'}
						</Button>
					</div>

					{#if importError}
						<p class="mt-2 text-xs text-[var(--gw-color-error)]">{importError}</p>
					{/if}

					{#if categories.length > 0}
						<!-- Category picker for large repos -->
						<div class="mt-[var(--gw-space-3)] space-y-[var(--gw-space-3)] rounded-[var(--gw-radius-lg)]
							border border-[var(--gw-color-border-subtle)] p-[var(--gw-space-3)]">
							<div class="flex items-center justify-between gap-2">
								<p class="text-xs font-semibold text-[var(--gw-color-text-muted)]">
									Categorías ({categories.length}) — selecciona las que quieres importar
								</p>
								<label class="flex cursor-pointer items-center gap-1.5 text-xs text-[var(--gw-color-text-muted)]">
									<input type="checkbox" checked={allCategoriesSelected} onchange={toggleAllCategories} />
									Todo
								</label>
							</div>
							<div class="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
								{#each categories as cat, i (cat.name)}
									<label
										class="flex cursor-pointer items-center gap-2 rounded-[var(--gw-radius-md)]
											border px-2 py-1.5 text-xs
											transition-colors duration-[150ms] ease-[cubic-bezier(0.32,0.72,0,1)]
											{cat.selected
												? 'border-[var(--gw-color-primary)] bg-[var(--gw-color-primary-subtle)] text-[var(--gw-color-text)]'
												: 'border-[var(--gw-color-border-subtle)] text-[var(--gw-color-text-muted)]'}"
									>
										<input type="checkbox" class="shrink-0" bind:checked={categories[i].selected} />
										<span class="min-w-0 flex-1 truncate font-[family-name:var(--gw-font-mono)]">{cat.name}</span>
										<span class="shrink-0 tabular-nums opacity-50">{cat.count}</span>
									</label>
								{/each}
							</div>
							<div class="flex items-center justify-between gap-2 pt-1">
								<p class="text-xs text-[var(--gw-color-text-muted)]">
									{categories.filter(c => c.selected).reduce((s, c) => s + c.count, 0)} skills seleccionadas
								</p>
								<Button
									type="button"
									disabled={loadingCategories || categories.filter(c => c.selected).length === 0}
									onclick={loadSelectedCategories}
								>
									{loadingCategories ? 'Cargando…' : 'Cargar skills seleccionadas'}
								</Button>
							</div>
						</div>
					{/if}

					{#if discovered.length > 0}
						<div class="mt-[var(--gw-space-3)] space-y-[var(--gw-space-3)]">
							<div class="flex flex-wrap items-center gap-[var(--gw-space-2)]">
								<label class="flex cursor-pointer items-center gap-1.5 text-xs text-[var(--gw-color-text-muted)]">
									<input type="checkbox" checked={allSelected} onchange={toggleAll} />
									<span>Seleccionar todo ({discovered.filter(d => d.selected).length}/{discovered.length})</span>
								</label>
								<label class="flex items-center gap-1.5 text-xs text-[var(--gw-color-text-muted)]">
									<span class="shrink-0">Grupo:</span>
									<input
										class="input w-32 text-xs"
										placeholder="taste-skill"
										value={discovered[0]?.group ?? ''}
										oninput={(e) => setGroupAll((e.target as HTMLInputElement).value)}
									/>
								</label>
								<div class="ml-auto flex items-center gap-[var(--gw-space-2)]">
									<select class="select text-xs" bind:value={importRole}>
										<option value="">Solo registrar</option>
										{#each ROLES as role (role)}<option value={role}>{role}</option>{/each}
									</select>
									<Button
										type="button"
										disabled={busy || missingGroup}
										title={missingGroup ? 'Asigna grupo a todas las skills seleccionadas' : ''}
										onclick={importSelected}
									>
										{importRole ? `Importar y cargar → ${importRole}` : 'Importar seleccionadas'}
									</Button>
								</div>
							</div>
							<div class="grid grid-cols-2 gap-[var(--gw-space-2)] lg:grid-cols-3">
								{#each discovered as d, i (d.path)}
									<div
										class="flex flex-col gap-1.5 rounded-[var(--gw-radius-lg)] border p-[var(--gw-space-3)]
											transition-colors duration-[150ms] ease-[cubic-bezier(0.32,0.72,0,1)]
											{d.selected
												? 'border-[var(--gw-color-primary)] bg-[var(--gw-color-primary-subtle)]'
												: 'border-[var(--gw-color-border-subtle)] opacity-50'}"
									>
										<div class="flex items-start justify-between gap-2">
											<input type="checkbox" class="mt-0.5 shrink-0" bind:checked={discovered[i].selected} />
											<input
												class="input h-5 min-w-0 flex-1 px-1 text-right
													font-[family-name:var(--gw-font-mono)] text-[10px] opacity-60"
												title="grupo"
												bind:value={discovered[i].group}
											/>
										</div>
										<p class="font-[family-name:var(--gw-font-mono)] text-xs font-semibold
											leading-tight text-[var(--gw-color-text)]">{d.name}</p>
										{#if d.description}
											<p class="line-clamp-2 text-xs text-[var(--gw-color-text-muted)]">{d.description}</p>
										{/if}
										<p class="mt-auto truncate pt-1 font-[family-name:var(--gw-font-mono)]
											text-[10px] text-[var(--gw-color-text-muted)] opacity-40">{d.path}</p>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- Manual registration form — Double-Bezel -->
			<form class="entry entry-4 bezel" onsubmit={registerSkill}>
				<div class="bezel-core p-[var(--gw-space-4)]">
					<p class="mb-[var(--gw-space-3)] text-[10px] font-semibold uppercase
						tracking-[0.12em] text-[var(--gw-color-text-muted)]">
						Register skill
					</p>
					<div class="flex flex-wrap items-end gap-[var(--gw-space-2)]">
						<input class="input w-40" placeholder="id (graphify)" bind:value={newSkill.skill} required />
						<input class="input w-36" placeholder="label" bind:value={newSkill.label} required />
						<input class="input w-36" placeholder="group" bind:value={newSkill.group} required />
						<input class="input flex-1" placeholder="description" bind:value={newSkill.description} />
						<input
							class="input w-56"
							placeholder="scopes (graph.read, …)"
							bind:value={newSkill.default_scopes_csv}
						/>
					</div>
					<textarea
						class="textarea mt-[var(--gw-space-3)] font-[family-name:var(--gw-font-mono)] text-xs"
						rows="4"
						placeholder="SKILL.md body — la definición que claude carga para el rol…"
						bind:value={newSkill.body}
					></textarea>
					<div class="mt-[var(--gw-space-3)]"><Button type="submit" disabled={busy}>Register skill</Button></div>
				</div>
			</form>
		{/if}

		{#if data.skills.length === 0}
			<p class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">No skills registered.</p>
		{:else}
			{@const grouped = data.skills.reduce((acc, s) => {
				const g = s.group || '';
				if (!acc.has(g)) acc.set(g, []);
				acc.get(g)!.push(s);
				return acc;
			}, new Map<string, typeof data.skills>())}
			{#each [...grouped.entries()] as [group, skills] (group)}
				{#if group}
					<div class="flex items-center gap-[var(--gw-space-3)]">
						<span
							class="inline-flex shrink-0 items-center rounded-full
								border border-[var(--gw-color-border-subtle)]
								bg-[var(--gw-color-surface-3)]
								px-[var(--gw-space-3)] py-[3px]
								text-[10px] font-semibold uppercase tracking-[0.14em]
								text-[var(--gw-color-text-muted)]"
						>{group}</span>
						<div class="group-rule"></div>
						{#if canWriteSkills}
							<button
								class="shrink-0 text-[10px] text-[var(--gw-color-error)] opacity-40
									transition-opacity duration-[150ms] hover:opacity-100 hover:underline"
								onclick={() => deleteGroup(group, skills.map(s => s.id))}
							>delete group</button>
						{/if}
					</div>
				{/if}
				<ul class="space-y-[var(--gw-space-2)]">
					{#each skills as s (s.id)}
						{@const enabledRoles = ROLES.filter((r) => hasSkill(r, s.id)).length}
						<li class="bezel">
							<div class="bezel-core p-[var(--gw-space-4)]">

								<!-- Skill header -->
								<div class="flex items-start justify-between gap-3">
									<div class="min-w-0 flex-1">
										<div class="flex flex-wrap items-center gap-2">
											<span class="font-semibold text-[var(--gw-color-text)]">{s.label}</span>
											<span class="font-[family-name:var(--gw-font-mono)] text-xs text-[var(--gw-color-text-muted)]">{s.id}</span>
											{#if s.body}<Badge variant="success">SKILL.md</Badge>{/if}
											{#if enabledRoles > 0}<Badge variant="primary">{enabledRoles} roles</Badge>{/if}
										</div>
										<p class="mt-0.5 line-clamp-1 text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">
											{s.description || '—'}
										</p>
									</div>
									<div class="flex shrink-0 items-center gap-1">
										<Button variant="tonal" onclick={() => toggleExpand(s.id)}>
											{expanded[s.id] ? 'Ocultar' : 'Ver'}
										</Button>
										{#if canWriteSkills}
											<Button variant="tonal" onclick={() => startEdit(s)}>Editar</Button>
											<button
												class="px-1 text-[var(--gw-color-error)] opacity-50
													transition-opacity hover:opacity-100 hover:underline"
												title="Retire skill"
												onclick={() => retireSkill(s.id)}
											>✕</button>
										{/if}
									</div>
								</div>

								{#if editing === s.id}
									<!-- Inline edit -->
									<div class="mt-[var(--gw-space-4)] space-y-[var(--gw-space-2)]
										border-t border-[var(--gw-color-border-subtle)] pt-[var(--gw-space-4)]">
										<div class="flex gap-[var(--gw-space-2)]">
											<input class="input flex-1" placeholder="label" bind:value={editForm.label} />
											<input class="input w-36" placeholder="group" bind:value={editForm.group} />
										</div>
										<input class="input w-full" placeholder="description" bind:value={editForm.description} />
										<textarea
											class="textarea font-[family-name:var(--gw-font-mono)] text-xs"
											rows="8"
											placeholder="SKILL.md body"
											bind:value={editForm.body}
										></textarea>
										<div class="flex gap-[var(--gw-space-2)]">
											<Button disabled={busy} onclick={() => saveEdit(s.id)}>Save</Button>
											<Button variant="tonal" onclick={() => (editing = null)}>Cancel</Button>
										</div>
									</div>

								{:else if expanded[s.id]}
									<div class="mt-[var(--gw-space-4)] space-y-[var(--gw-space-3)]
										border-t border-[var(--gw-color-border-subtle)] pt-[var(--gw-space-4)]">
										{#if s.default_scopes.length}
											<div class="flex flex-wrap gap-1">
												{#each s.default_scopes as sc (sc)}<Badge variant="surface">{sc}</Badge>{/each}
											</div>
										{/if}
										{#if s.body}
											<div class="max-h-64 overflow-auto rounded-[var(--gw-radius-md)]
												bg-[var(--gw-color-surface-3)] p-[var(--gw-space-3)]">
												<Markdown text={s.body} />
											</div>
										{:else}
											<p class="text-xs text-[var(--gw-color-text-muted)]">No SKILL.md body.</p>
										{/if}
										<p class="text-[10px] text-[var(--gw-color-text-muted)]">
											Enable this skill for a role in <a class="underline" href="{base}/agents">Agents</a>.
										</p>
									</div>
								{/if}

							</div>
						</li>
					{/each}
				</ul>
			{/each}
		{/if}

	<!-- ══ FEED ═══════════════════════════════════════════════════════════ -->
	{:else}
		{#if data.feedError}
			<p class="text-[var(--gw-text-sm)] text-[var(--gw-color-error)]">{data.feedError}</p>
		{/if}
		{#if data.feed.length === 0}
			<p class="entry entry-3 text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">
				No recent events.
			</p>
		{:else}
			<div class="entry entry-3 bezel">
				<div class="bezel-core-overflow">
					<ul class="divide-y divide-[var(--gw-color-border-subtle)]">
						{#each data.feed as e (e.event_id)}
							<li class="feed-row flex items-center gap-[var(--gw-space-3)]
								px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
								<Badge variant="primary">{e.kind}</Badge>
								<span class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
									{new Date(e.ts).toLocaleString()}
								</span>
								<span class="truncate font-[family-name:var(--gw-font-mono)]
									text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)] opacity-50">
									{e.correlation_id}
								</span>
							</li>
						{/each}
					</ul>
				</div>
			</div>
		{/if}
	{/if}

</div>

{#if showCreate}
	<CreateDocModal createdBy={data.user?.sub ?? 'gt-web'} onclose={() => (showCreate = false)} />
{/if}
