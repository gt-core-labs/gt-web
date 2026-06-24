<script lang="ts">
	import { enhance } from '$app/forms';
	import { Icon } from '$lib/ui';
	import type { Connection } from '$lib/api/connection';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Rigs of the active workspace. (Re)connecting to a VCS connection is inline (when rig.write);
	// registering/deleting still lives in Add-ons → GitHub. The graph freshness chip is for context.
	type GraphChip = { state: 'built' | 'behind' | 'stale'; commit: string | null } | null;
	function graphChip(rigName: string): GraphChip {
		const c = data.graphCustody.find((g) => g.rig === rigName);
		if (!c) return null;
		const state = !c.stale ? 'built' : c.last_indexed_commit ? 'behind' : 'stale';
		return { state, commit: c.last_indexed_commit };
	}
	const CHIP_LABEL = { built: 'Built', behind: 'Behind', stale: 'Not built' } as const;

	// A rig whose git_connection_ref points at a connection that no longer exists has "lost" it.
	const connExists = (id: string | null | undefined) =>
		!!id && data.connections.some((c) => c.id === id);

	// Only active connections are bindable targets; label by account/org login.
	const activeConnections = $derived(data.connections.filter((c) => c.status === 'active'));
	const connLabel = (c: Connection) => (c.account_login ? `${c.account_login} (${c.id})` : c.id);

	// The connection selected per rig in the picker — seeded from the server entry and re-synced
	// whenever the load data changes (e.g. after a successful save reloads the page data).
	let selected = $state<Record<string, string>>({});
	$effect(() => {
		selected = Object.fromEntries(data.rigs.map((r) => [r.name, r.git_connection_ref ?? '']));
	});

	// The rig whose save is in flight (disables its control + shows a spinner).
	let saving = $state<string | null>(null);
	const isDirty = (name: string, current: string | null | undefined) =>
		(selected[name] ?? '') !== (current ?? '');
</script>

<div class="mx-auto max-w-4xl space-y-6">
	<header class="flex items-start gap-4">
		<div
			class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl
				border border-[var(--gw-color-border)] bg-[var(--gw-color-surface-3)] text-[var(--gw-color-text)]"
		>
			<Icon icon="lucide:git-branch" size={24} />
		</div>
		<div class="min-w-0">
			<h1 class="text-2xl font-semibold tracking-tight text-[var(--gw-color-text)]">Rigs</h1>
			<p class="mt-1 text-sm text-[var(--gw-color-text-muted)]">
				Repos registered in the active workspace (switch workspace in the header to view another).
				Register, delete or refresh them under
				<a href="/complementos/github" class="underline">Add-ons → GitHub</a>.
			</p>
		</div>
	</header>

	<section class="bezel" aria-label="Rigs">
		<div class="bezel-core px-[var(--gw-space-6)] py-[var(--gw-space-5)] space-y-[var(--gw-space-4)]">
			<div class="flex items-baseline gap-[var(--gw-space-2)]">
				<h2 class="text-[var(--gw-text-base)] font-semibold text-[var(--gw-color-text)]">Repos</h2>
				<span class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">{data.rigs.length}</span>
				<span class="ml-auto text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
					workspace: <strong>{data.activeWorkspace}</strong>
				</span>
			</div>

			{#if data.rigError}
				<aside class="warn-banner" role="alert">Could not list this workspace's repos: {data.rigError}</aside>
			{/if}
			{#if form?.error}
				<aside class="warn-banner" role="alert">Could not update connection: {form.error}</aside>
			{/if}

			<!-- Repos table -->
			<div class="bezel-core-overflow border border-[var(--gw-color-border-subtle)]">
				{#if data.rigs.length > 0}
					<div class="overflow-x-auto">
						<table class="w-full min-w-[760px] text-left">
							<thead>
								<tr class="border-b border-[var(--gw-color-border-subtle)]">
									<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Name</th>
									<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Prefix</th>
									<th class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)] md:table-cell">Git URL</th>
									<th class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)] lg:table-cell">Connection</th>
									<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Graph</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-[var(--gw-color-border-subtle)]">
								{#each data.rigs as rig (rig.name)}
									<tr class="data-row">
										<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
											<span class="text-[var(--gw-text-sm)] font-medium text-[var(--gw-color-text)]">{rig.name}</span>
										</td>
										<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]"><span class="chip">{rig.prefix}</span></td>
										<td class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] md:table-cell">
											<span class="block max-w-[260px] truncate font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]" title={rig.git_url}>{rig.git_url}</span>
										</td>
										<td class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] lg:table-cell">
											{#if data.canWriteRig}
												<!-- Inline (re)connect: pick a connection (or "—" to clear) and save (gtcore-1ff551). -->
												<form
													method="POST"
													action="?/setConnection"
													class="conn-form"
													use:enhance={() => {
														saving = rig.name;
														return async ({ update }) => {
															await update();
															saving = null;
														};
													}}
												>
													<input type="hidden" name="name" value={rig.name} />
													<select
														class="conn-select"
														class:conn-lost={rig.git_connection_ref && !connExists(rig.git_connection_ref)}
														name="git_connection_ref"
														bind:value={selected[rig.name]}
														disabled={saving === rig.name}
														aria-label={`Connection for ${rig.name}`}
													>
														<option value="">— (unbound)</option>
														{#if rig.git_connection_ref && !connExists(rig.git_connection_ref)}
															<option value={rig.git_connection_ref}>⚠ {rig.git_connection_ref} (lost)</option>
														{/if}
														{#each activeConnections as c (c.id)}
															<option value={c.id}>{connLabel(c)}</option>
														{/each}
													</select>
													<button
														type="submit"
														class="btn-refresh"
														disabled={saving === rig.name || !isDirty(rig.name, rig.git_connection_ref)}
														title="Save connection"
													>
														{#if saving === rig.name}
															<Icon icon="lucide:loader-2" size={12} class="spin" />
														{:else}
															<Icon icon="lucide:plug" size={12} />
														{/if}
														Save
													</button>
												</form>
											{:else if rig.git_connection_ref}
												{#if connExists(rig.git_connection_ref)}
													<span class="chip" title="git_connection_ref">{rig.git_connection_ref}</span>
												{:else}
													<span class="chip chip-warn" title="Connection lost — needs rig.write to reconnect">⚠ {rig.git_connection_ref}</span>
												{/if}
											{:else}
												<span class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">—</span>
											{/if}
										</td>
										<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
											{#key data.graphCustody}
												{@const chip = graphChip(rig.name)}
												<div class="graph-cell">
													{#if chip}
														<span class="chip chip-status" title={chip.commit ? `Last indexed commit: ${chip.commit}` : 'No indexed commit yet'}>
															<span class="dot dot-{chip.state}"></span>{CHIP_LABEL[chip.state]}
														</span>
													{:else}
														<span class="chip" title="No graph custody — refresh under Add-ons → GitHub"><span class="dot"></span>—</span>
													{/if}
												</div>
											{/key}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<div class="flex flex-col items-center justify-center gap-[var(--gw-space-2)] px-[var(--gw-space-6)] py-[var(--gw-space-10)]">
						<Icon icon="lucide:git-branch" size={20} />
						<p class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">No repos registered.</p>
					</div>
				{/if}
			</div>
		</div>
	</section>
</div>

<style>
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
	.bezel-core-overflow {
		border-radius: calc(var(--gw-radius-2xl) - 3px);
		background-color: var(--gw-color-surface);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
		overflow: hidden;
	}
	.gw-input {
		display: block;
		width: 100%;
		border-radius: var(--gw-radius-lg);
		border: 1px solid var(--gw-color-border);
		background-color: var(--gw-color-surface-3);
		color: var(--gw-color-text);
		font-size: var(--gw-text-sm);
		padding: 0.5rem 0.75rem;
		outline: none;
	}
	.gw-input:focus {
		border-color: var(--gw-color-primary);
		box-shadow: 0 0 0 3px oklch(60% 0.22 250 / 0.1);
	}
	.gw-input::placeholder {
		color: var(--gw-color-text-muted);
		opacity: 0.55;
	}
	.cta {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		border-radius: 9999px;
		border: none;
		background: linear-gradient(135deg, oklch(60% 0.22 250), oklch(50% 0.24 270));
		color: white;
		font-size: var(--gw-text-sm);
		font-weight: 600;
		padding: 0.5625rem 1.25rem;
		cursor: pointer;
		white-space: nowrap;
	}
	.cta:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.cta-arrow {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 9999px;
		background-color: rgba(255, 255, 255, 0.18);
		font-size: 0.85rem;
	}
	.btn-danger {
		display: inline-flex;
		align-items: center;
		border-radius: 9999px;
		border: 1px solid var(--gw-color-border);
		background-color: var(--gw-color-surface-3);
		color: var(--gw-color-error);
		font-size: var(--gw-text-xs);
		font-weight: 500;
		padding: 0.3125rem 0.75rem;
		cursor: pointer;
	}
	.btn-danger:hover:not(:disabled) {
		border-color: var(--gw-color-error);
	}
	.btn-danger:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		border-radius: 9999px;
		background-color: var(--gw-color-surface-3);
		border: 1px solid var(--gw-color-border-subtle);
		font-family: var(--gw-font-mono);
		font-size: 11px;
		font-weight: 600;
		padding: 2px 8px;
		color: var(--gw-color-text-muted);
		letter-spacing: 0.04em;
	}
	.chip-status {
		text-transform: uppercase;
	}
	.chip-warn {
		color: var(--gw-color-error);
		border-color: var(--gw-color-error);
	}
	.dot {
		width: 6px;
		height: 6px;
		border-radius: 9999px;
		background-color: var(--gw-color-text-muted);
		opacity: 0.6;
	}
	.dot-built {
		background-color: oklch(65% 0.18 150);
		opacity: 1;
	}
	.dot-behind {
		background-color: oklch(75% 0.16 80);
		opacity: 1;
	}
	.dot-stale {
		background-color: var(--gw-color-error);
		opacity: 1;
	}
	.graph-cell {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}
	.conn-form {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}
	.conn-select {
		max-width: 220px;
		border-radius: var(--gw-radius-lg);
		border: 1px solid var(--gw-color-border);
		background-color: var(--gw-color-surface-3);
		color: var(--gw-color-text);
		font-family: var(--gw-font-mono);
		font-size: 11px;
		padding: 3px 8px;
		outline: none;
		cursor: pointer;
	}
	.conn-select:focus {
		border-color: var(--gw-color-primary);
		box-shadow: 0 0 0 3px oklch(60% 0.22 250 / 0.1);
	}
	.conn-lost {
		border-color: var(--gw-color-error);
		color: var(--gw-color-error);
	}
	.btn-refresh {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		border-radius: 9999px;
		border: 1px solid var(--gw-color-border);
		background-color: var(--gw-color-surface-3);
		color: var(--gw-color-text-muted);
		font-size: 11px;
		font-weight: 500;
		padding: 2px 8px;
		cursor: pointer;
	}
	.btn-refresh:hover:not(:disabled) {
		border-color: var(--gw-color-text-muted);
		color: var(--gw-color-text);
	}
	.btn-refresh:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.spin {
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.warn-banner {
		border-radius: var(--gw-radius-xl);
		border: 1px solid oklch(88% 0.1 80);
		background-color: oklch(97% 0.04 80);
		color: oklch(48% 0.18 80);
		font-size: var(--gw-text-xs);
		padding: var(--gw-space-3) var(--gw-space-4);
	}
	.data-row {
		transition: background-color 140ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.data-row:hover {
		background-color: var(--gw-color-surface-3);
	}
	.label {
		display: block;
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--gw-color-text-muted);
	}
</style>
