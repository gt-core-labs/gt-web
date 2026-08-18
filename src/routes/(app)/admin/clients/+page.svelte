<script lang="ts">
	import { enhance } from '$app/forms';
	import { base } from '$app/paths';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let saving = $state(false);

	const editing = $derived(data.editing);

	const enhancer = () => {
		saving = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			saving = false;
		};
	};
</script>

<style>
	@keyframes fade-up-in {
		from { opacity: 0; transform: translateY(10px); }
		to   { opacity: 1; transform: translateY(0); }
	}
	.entry   { animation: fade-up-in 480ms cubic-bezier(0.32, 0.72, 0, 1) both; }
	.entry-1 { animation-delay: 0ms; }
	.entry-2 { animation-delay: 60ms; }
	.entry-3 { animation-delay: 120ms; }

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
		display: block; width: 100%;
		border-radius: var(--gw-radius-lg);
		border: 1px solid var(--gw-color-border);
		background-color: var(--gw-color-surface-3);
		color: var(--gw-color-text); font-size: var(--gw-text-sm);
		padding: 0.5rem 0.75rem;
		transition: border-color 160ms cubic-bezier(0.32, 0.72, 0, 1),
		            box-shadow   160ms cubic-bezier(0.32, 0.72, 0, 1);
		outline: none;
	}
	.gw-input:focus { border-color: var(--gw-color-primary); box-shadow: 0 0 0 3px oklch(60% 0.22 250 / 0.1); }
	.gw-input::placeholder { color: var(--gw-color-text-muted); opacity: 0.55; }
	.gw-input:disabled { opacity: 0.45; cursor: not-allowed; background-color: var(--gw-color-surface-3); }

	.gw-textarea {
		display: block; width: 100%; resize: vertical; min-height: 4rem;
		border-radius: var(--gw-radius-lg);
		border: 1px solid var(--gw-color-border);
		background-color: var(--gw-color-surface-3);
		color: var(--gw-color-text); font-size: var(--gw-text-sm);
		font-family: var(--gw-font-mono);
		padding: 0.5rem 0.75rem;
		transition: border-color 160ms cubic-bezier(0.32, 0.72, 0, 1);
		outline: none;
	}
	.gw-textarea:focus { border-color: var(--gw-color-primary); box-shadow: 0 0 0 3px oklch(60% 0.22 250 / 0.1); }

	.gw-check {
		appearance: none; width: 1rem; height: 1rem;
		border-radius: var(--gw-radius-sm);
		border: 1px solid var(--gw-color-border);
		background-color: var(--gw-color-surface-3);
		cursor: pointer; flex-shrink: 0; position: relative;
		transition: border-color 140ms cubic-bezier(0.32, 0.72, 0, 1),
		            background-color 140ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.gw-check:checked {
		border-color: oklch(60% 0.22 250);
		background: linear-gradient(135deg, oklch(60% 0.22 250), oklch(50% 0.24 270));
	}
	.gw-check:checked::after {
		content: ''; position: absolute; left: 3px; top: 1px;
		width: 5px; height: 8px;
		border: 1.5px solid white; border-top: none; border-left: none;
		transform: rotate(45deg);
	}

	.cta {
		display: inline-flex; align-items: center; gap: 0.5rem;
		border-radius: 9999px; border: none;
		background: linear-gradient(135deg, oklch(60% 0.22 250), oklch(50% 0.24 270));
		color: white; font-size: var(--gw-text-sm); font-weight: 600;
		padding: 0.5625rem 1.25rem; cursor: pointer; white-space: nowrap;
		transition: opacity 200ms cubic-bezier(0.32, 0.72, 0, 1),
		            transform 200ms cubic-bezier(0.32, 0.72, 0, 1),
		            box-shadow 200ms cubic-bezier(0.32, 0.72, 0, 1);
		box-shadow: 0 4px 14px -2px oklch(60% 0.22 250 / 0.35);
	}
	.cta:hover:not(:disabled) { opacity: 0.92; box-shadow: 0 6px 20px -2px oklch(60% 0.22 250 / 0.45); }
	.cta:active:not(:disabled) { transform: scale(0.98); }
	.cta:disabled { opacity: 0.4; cursor: not-allowed; }
	.cta-arrow {
		display: inline-flex; align-items: center; justify-content: center;
		width: 1.5rem; height: 1.5rem; border-radius: 9999px;
		background-color: rgba(255, 255, 255, 0.18); font-size: 0.85rem;
		transition: transform 200ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.cta:hover:not(:disabled) .cta-arrow { transform: translateX(2px); }

	.btn-ghost {
		display: inline-flex; align-items: center; gap: 0.375rem;
		border-radius: 9999px; border: 1px solid var(--gw-color-border);
		background-color: var(--gw-color-surface-3); color: var(--gw-color-text);
		font-size: var(--gw-text-xs); font-weight: 500;
		padding: 0.375rem 0.875rem; cursor: pointer; white-space: nowrap;
		text-decoration: none;
		transition: border-color 150ms cubic-bezier(0.32, 0.72, 0, 1),
		            background-color 150ms cubic-bezier(0.32, 0.72, 0, 1),
		            transform 150ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.btn-ghost:hover:not(:disabled) { border-color: var(--gw-color-primary); background-color: var(--gw-color-surface); }
	.btn-ghost:active:not(:disabled) { transform: scale(0.97); }

	.btn-primary-sm {
		display: inline-flex; align-items: center;
		border-radius: 9999px; border: none;
		background: linear-gradient(135deg, oklch(60% 0.22 250), oklch(50% 0.24 270));
		color: white; font-size: var(--gw-text-xs); font-weight: 500;
		padding: 0.3125rem 0.75rem; cursor: pointer; white-space: nowrap;
		text-decoration: none;
		transition: opacity 150ms cubic-bezier(0.32, 0.72, 0, 1), transform 150ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.btn-primary-sm:hover { opacity: 0.88; }
	.btn-primary-sm:active { transform: scale(0.97); }

	.btn-toggle-on {
		display: inline-flex; align-items: center; gap: 4px;
		border-radius: 9999px; border: 1px solid oklch(85% 0.1 150);
		background-color: oklch(96% 0.05 150); color: oklch(42% 0.16 150);
		font-size: var(--gw-text-xs); font-weight: 600;
		padding: 0.3125rem 0.75rem; cursor: pointer;
		transition: opacity 150ms cubic-bezier(0.32, 0.72, 0, 1), transform 150ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.btn-toggle-on:hover:not(:disabled) { opacity: 0.8; }
	.btn-toggle-on:disabled { opacity: 0.4; cursor: not-allowed; }

	.btn-toggle-off {
		display: inline-flex; align-items: center; gap: 4px;
		border-radius: 9999px; border: 1px solid var(--gw-color-border-subtle);
		background-color: var(--gw-color-surface-3); color: var(--gw-color-text-muted);
		font-size: var(--gw-text-xs); font-weight: 600;
		padding: 0.3125rem 0.75rem; cursor: pointer;
		transition: border-color 150ms cubic-bezier(0.32, 0.72, 0, 1), transform 150ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.btn-toggle-off:hover:not(:disabled) { border-color: var(--gw-color-primary); }

	.btn-danger {
		display: inline-flex; align-items: center;
		border-radius: 9999px; border: 1px solid var(--gw-color-border);
		background-color: var(--gw-color-surface-3); color: var(--gw-color-error);
		font-size: var(--gw-text-xs); font-weight: 500;
		padding: 0.3125rem 0.75rem; cursor: pointer; white-space: nowrap;
		transition: border-color 150ms cubic-bezier(0.32, 0.72, 0, 1),
		            background-color 150ms cubic-bezier(0.32, 0.72, 0, 1),
		            transform 150ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.btn-danger:hover:not(:disabled) { border-color: var(--gw-color-error); background-color: oklch(98% 0.015 25); }
	.btn-danger:active:not(:disabled) { transform: scale(0.97); }

	.warn-banner {
		border-radius: var(--gw-radius-xl);
		border: 1px solid oklch(88% 0.1 80); background-color: oklch(97% 0.04 80);
		color: oklch(48% 0.18 80); font-size: var(--gw-text-xs);
		padding: var(--gw-space-3) var(--gw-space-4);
	}

	.field-label {
		display: block; text-transform: uppercase; letter-spacing: 0.12em;
		font-size: 10px; font-weight: 600; color: var(--gw-color-text-muted);
		margin-bottom: var(--gw-space-1);
	}
	.field-label-note { text-transform: none; letter-spacing: normal; opacity: 0.6; }

	.data-row { transition: background-color 140ms cubic-bezier(0.32, 0.72, 0, 1); }
	.data-row:hover { background-color: var(--gw-color-surface-3); }

	.scope-chip {
		display: inline-flex; align-items: center;
		border-radius: 9999px;
		background-color: var(--gw-color-surface-3); border: 1px solid var(--gw-color-border-subtle);
		font-size: 10px; font-weight: 600; padding: 1px 7px;
		color: var(--gw-color-text-muted); font-family: var(--gw-font-mono);
	}
</style>

<div class="space-y-5">

	<!-- Header -->
	<header class="entry entry-1 space-y-2">
		<span
			class="inline-flex items-center rounded-full border border-[var(--gw-color-border-subtle)]
				bg-[var(--gw-color-surface-3)] px-[var(--gw-space-3)] py-[3px]
				text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--gw-color-text-muted)]"
		>
			Admin
		</span>
		<div class="flex items-baseline gap-[var(--gw-space-2)]">
			<h1
				class="text-[var(--gw-text-3xl)] font-semibold leading-[var(--gw-leading-tight)]
					tracking-tight text-[var(--gw-color-text)]"
			>
				OAuth Clients
			</h1>
			<span class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">
				{data.clients.length}
			</span>
		</div>
		<p class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
			Downstream applications that authenticate users through gt (e.g. Claude.ai remote MCP connector).
		</p>
	</header>

	<!-- Load error -->
	{#if data.loadError}
		<aside class="entry entry-1 warn-banner" role="alert">
			{data.loadError}
		</aside>
	{/if}

	<!-- Feedback -->
	{#if form?.error}
		<p class="entry entry-1 text-[var(--gw-text-xs)] text-[var(--gw-color-error)]">{form.error}</p>
	{/if}
	{#if form?.ok}
		<span class="entry entry-1 inline-flex items-center gap-[var(--gw-space-1)] text-[var(--gw-text-xs)]"
			style="color: oklch(42% 0.16 150)">
			<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
				stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="20 6 9 17 4 12"/>
			</svg>
			Saved.
		</span>
	{/if}

	<!-- Edit / Create form -->
	{#if editing}
		<section class="entry entry-2 bezel" aria-label="Edit OAuth client">
			<div class="bezel-core px-[var(--gw-space-6)] py-[var(--gw-space-5)]">
				<div class="mb-[var(--gw-space-4)] flex items-center justify-between gap-[var(--gw-space-4)]">
					<div class="flex items-center gap-[var(--gw-space-3)]">
						<div
							class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--gw-radius-lg)]
								border border-[var(--gw-color-border-subtle)] bg-[var(--gw-color-surface-3)]"
							aria-hidden="true"
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
								stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
								style="color: var(--gw-color-text-muted)">
								<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
								<path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
							</svg>
						</div>
						<div>
							<h2 class="text-[var(--gw-text-base)] font-semibold text-[var(--gw-color-text)]">
								Edit client
							</h2>
							<p class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
								{editing.client_id}
							</p>
						</div>
					</div>
					<a href="{base}/admin/clients" class="btn-ghost flex-shrink-0">Cancel</a>
				</div>

				<form method="POST" action="?/update" use:enhance={enhancer} class="max-w-2xl space-y-[var(--gw-space-4)]">
					<input type="hidden" name="client_id" value={editing.client_id} />
					<div class="grid gap-[var(--gw-space-3)] sm:grid-cols-2">
						<div class="space-y-[var(--gw-space-1)]">
							<span class="field-label">Client ID</span>
							<input class="gw-input" type="text" value={editing.client_id} disabled />
						</div>
						<div class="space-y-[var(--gw-space-1)]">
							<label for="edit-display-name" class="field-label">Display name</label>
							<input id="edit-display-name" class="gw-input" type="text" name="display_name" required value={editing.display_name} />
						</div>
						<div class="space-y-[var(--gw-space-1)] sm:col-span-2">
							<label for="edit-client-secret" class="field-label">
								Rotate client secret
								<span class="field-label-note">(leave empty to keep)</span>
							</label>
							<input id="edit-client-secret" class="gw-input" type="password" name="client_secret" autocomplete="off" placeholder="••••••••" />
						</div>
						<div class="space-y-[var(--gw-space-1)] sm:col-span-2">
							<label for="edit-redirect-uris" class="field-label">
								Redirect URIs <span class="field-label-note">(one per line or comma-separated)</span>
							</label>
							<textarea id="edit-redirect-uris" class="gw-textarea" name="redirect_uris">{editing.redirect_uris.join('\n')}</textarea>
						</div>
						<div class="space-y-[var(--gw-space-1)] sm:col-span-2">
							<label for="edit-scopes" class="field-label">
								Allowed scopes <span class="field-label-note">(comma-separated ceiling)</span>
							</label>
							<input id="edit-scopes" class="gw-input" type="text" name="allowed_scopes" value={editing.allowed_scopes} placeholder="issues.read,memory.read" />
						</div>
					</div>

					<label class="flex cursor-pointer items-center gap-[var(--gw-space-2)]">
						<input type="checkbox" class="gw-check" name="enabled" checked={editing.enabled} />
						<span class="text-[var(--gw-text-sm)] text-[var(--gw-color-text)]">Enabled</span>
					</label>

					<button type="submit" class="cta" disabled={saving}>
						{#if saving}
							<svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"/>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
							</svg>
							<span>Saving...</span>
						{:else}
							<span>Save changes</span>
							<span class="cta-arrow" aria-hidden="true">&#8594;</span>
						{/if}
					</button>
				</form>
			</div>
		</section>

	{:else}
		<section class="entry entry-2 bezel" aria-label="Add OAuth client">
			<div class="bezel-core px-[var(--gw-space-6)] py-[var(--gw-space-5)]">
				<div class="mb-[var(--gw-space-4)] flex items-center gap-[var(--gw-space-3)]">
					<div
						class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--gw-radius-lg)]
							border border-[var(--gw-color-border-subtle)] bg-[var(--gw-color-surface-3)]"
						aria-hidden="true"
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
							stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
							style="color: var(--gw-color-text-muted)">
							<circle cx="12" cy="12" r="10"/>
							<line x1="12" y1="8" x2="12" y2="16"/>
							<line x1="8" y1="12" x2="16" y2="12"/>
						</svg>
					</div>
					<h2 class="text-[var(--gw-text-base)] font-semibold text-[var(--gw-color-text)]">
						Register client
					</h2>
				</div>

				<form method="POST" action="?/create" use:enhance={enhancer} class="max-w-2xl space-y-[var(--gw-space-4)]">
					<div class="grid gap-[var(--gw-space-3)] sm:grid-cols-2">
						<div class="space-y-[var(--gw-space-1)]">
							<label for="create-client-id" class="field-label">
								Client ID <span class="field-label-note">(slug, unique)</span>
							</label>
							<input id="create-client-id" class="gw-input" type="text" name="client_id" required placeholder="claude-ai" />
						</div>
						<div class="space-y-[var(--gw-space-1)]">
							<label for="create-display-name" class="field-label">Display name</label>
							<input id="create-display-name" class="gw-input" type="text" name="display_name" required placeholder="Claude.ai Remote MCP" />
						</div>
						<div class="space-y-[var(--gw-space-1)] sm:col-span-2">
							<label for="create-client-secret" class="field-label">Client secret</label>
							<input id="create-client-secret" class="gw-input" type="password" name="client_secret" autocomplete="off" required />
						</div>
						<div class="space-y-[var(--gw-space-1)] sm:col-span-2">
							<label for="create-redirect-uris" class="field-label">
								Redirect URIs <span class="field-label-note">(one per line or comma-separated)</span>
							</label>
							<textarea id="create-redirect-uris" class="gw-textarea" name="redirect_uris" placeholder="https://claude.ai/api/mcp/oauth/callback"></textarea>
						</div>
						<div class="space-y-[var(--gw-space-1)] sm:col-span-2">
							<label for="create-scopes" class="field-label">
								Allowed scopes <span class="field-label-note">(comma-separated ceiling, empty = all user scopes)</span>
							</label>
							<input id="create-scopes" class="gw-input" type="text" name="allowed_scopes" placeholder="issues.read,issues.write,memory.read,memory.write" />
						</div>
					</div>

					<button type="submit" class="cta" disabled={saving}>
						{#if saving}
							<svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"/>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
							</svg>
							<span>Creating...</span>
						{:else}
							<span>Register client</span>
							<span class="cta-arrow" aria-hidden="true">&#8594;</span>
						{/if}
					</button>
				</form>
			</div>
		</section>
	{/if}

	<!-- Clients table -->
	<section class="entry entry-3 bezel" aria-label="OAuth clients list">
		<div class="bezel-core-overflow">
			{#if data.clients.length > 0}
				<table class="w-full text-left">
					<thead>
						<tr class="border-b border-[var(--gw-color-border-subtle)]">
							<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Name</th>
							<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Client ID</th>
							<th class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)] md:table-cell">Scopes</th>
							<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Enabled</th>
							<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-[var(--gw-color-border-subtle)]">
						{#each data.clients as c (c.client_id)}
							<tr class="data-row">
								<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
									<span class="text-[var(--gw-text-sm)] font-medium text-[var(--gw-color-text)]">
										{c.display_name}
									</span>
								</td>
								<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
									<span class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
										{c.client_id}
									</span>
								</td>
								<td class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] md:table-cell">
									<span class="flex flex-wrap gap-1">
										{#each (c.allowed_scopes || '').split(',').filter(Boolean) as s}
											<span class="scope-chip">{s.trim()}</span>
										{:else}
											<span class="text-[10px] text-[var(--gw-color-text-muted)] italic">all</span>
										{/each}
									</span>
								</td>
								<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
									<form method="POST" action="?/toggle" use:enhance={enhancer}>
										<input type="hidden" name="client_id" value={c.client_id} />
										<input type="hidden" name="enabled" value={c.enabled ? 'false' : 'true'} />
										<button type="submit" class={c.enabled ? 'btn-toggle-on' : 'btn-toggle-off'} disabled={saving}>
											{#if c.enabled}
												<span class="h-1.5 w-1.5 rounded-full bg-current"></span>
											{/if}
											{c.enabled ? 'On' : 'Off'}
										</button>
									</form>
								</td>
								<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
									<span class="flex items-center justify-end gap-[var(--gw-space-2)]">
										<a href="{base}/admin/clients?edit={encodeURIComponent(c.client_id)}" class="btn-primary-sm">Edit</a>
										<form method="POST" action="?/delete" use:enhance={enhancer}
											onsubmit={(e) => { if (!confirm(`Delete client ${c.client_id}? This cannot be undone.`)) e.preventDefault(); }}>
											<input type="hidden" name="client_id" value={c.client_id} />
											<button type="submit" class="btn-danger" disabled={saving}>Delete</button>
										</form>
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<div class="flex flex-col items-center justify-center gap-[var(--gw-space-2)] px-[var(--gw-space-6)] py-[var(--gw-space-10)]">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
						stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
						style="color: var(--gw-color-text-muted); opacity: 0.4" aria-hidden="true">
						<circle cx="12" cy="12" r="10"/>
						<line x1="12" y1="8" x2="12" y2="16"/>
						<line x1="8" y1="12" x2="16" y2="12"/>
					</svg>
					<p class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">No OAuth clients registered.</p>
				</div>
			{/if}
		</div>
	</section>

</div>
