<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { PRESET_KINDS, type ProviderKind } from '$lib/api/auth';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let saving = $state(false);

	const callbackUrl = $derived(`${page.url.origin}/auth/callback`);
	let copied = $state(false);
	const copyCallback = async () => {
		await navigator.clipboard.writeText(callbackUrl);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	};

	const KINDS: ProviderKind[] = ['google', 'github', 'microsoft', 'generic'];
	const isPreset = (k: ProviderKind) => PRESET_KINDS.includes(k);

	let createKind = $state<ProviderKind>('google');
	const createNeedsEndpoints = $derived(!isPreset(createKind));

	const editing = $derived(data.editing);
	const editNeedsEndpoints = $derived(editing ? !isPreset(editing.kind) : false);

	const enhancer = () => {
		saving = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			saving = false;
		};
	};

	const KIND_GLYPHS: Record<string, string> = {
		google: 'G', github: '', microsoft: '⊞', generic: '⬡'
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

	.gw-select {
		display: block; width: 100%; appearance: none;
		border-radius: var(--gw-radius-lg);
		border: 1px solid var(--gw-color-border);
		background-color: var(--gw-color-surface-3);
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 0.75rem center;
		color: var(--gw-color-text); font-size: var(--gw-text-sm);
		padding: 0.5rem 2.25rem 0.5rem 0.75rem;
		transition: border-color 160ms cubic-bezier(0.32, 0.72, 0, 1);
		outline: none; cursor: pointer;
	}
	.gw-select:focus { border-color: var(--gw-color-primary); box-shadow: 0 0 0 3px oklch(60% 0.22 250 / 0.1); }

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
	.btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }

	.btn-primary-sm {
		display: inline-flex; align-items: center;
		border-radius: 9999px; border: none;
		background: linear-gradient(135deg, oklch(60% 0.22 250), oklch(50% 0.24 270));
		color: white; font-size: var(--gw-text-xs); font-weight: 500;
		padding: 0.3125rem 0.75rem; cursor: pointer; white-space: nowrap;
		text-decoration: none;
		transition: opacity 150ms cubic-bezier(0.32, 0.72, 0, 1),
		            transform 150ms cubic-bezier(0.32, 0.72, 0, 1);
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
	.btn-toggle-off:disabled { opacity: 0.4; cursor: not-allowed; }

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
	.btn-danger:disabled { opacity: 0.4; cursor: not-allowed; }

	.kind-chip {
		display: inline-flex; align-items: center; gap: 5px;
		border-radius: 9999px;
		background-color: var(--gw-color-surface-3); border: 1px solid var(--gw-color-border-subtle);
		font-size: 10px; font-weight: 600; padding: 2px 8px;
		color: var(--gw-color-text-muted); text-transform: capitalize; letter-spacing: 0.04em;
	}
	.kind-glyph {
		display: inline-flex; align-items: center; justify-content: center;
		width: 14px; height: 14px; border-radius: 9999px;
		background-color: var(--gw-color-surface); border: 1px solid var(--gw-color-border-subtle);
		font-size: 8px; font-weight: 700; line-height: 1;
	}

	.callback-code {
		display: block; word-break: break-all;
		font-family: var(--gw-font-mono); font-size: var(--gw-text-xs);
		background-color: var(--gw-color-surface-3); border: 1px solid var(--gw-color-border-subtle);
		border-radius: var(--gw-radius-md); padding: 0.5rem 0.75rem;
		color: var(--gw-color-text);
	}

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

	.endpoints-panel {
		border-radius: var(--gw-radius-xl); border: 1px solid var(--gw-color-border-subtle);
		background-color: var(--gw-color-surface-3); padding: var(--gw-space-4);
	}

	.data-row { transition: background-color 140ms cubic-bezier(0.32, 0.72, 0, 1); }
	.data-row:hover { background-color: var(--gw-color-surface-3); }
</style>

<div class="space-y-5">

	<!-- ── Header ──────────────────────────────────────────────────────────── -->
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
				OAuth Providers
			</h1>
			<span class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">
				{data.providers.length}
			</span>
		</div>
	</header>

	<!-- ── Load error ──────────────────────────────────────────────────────── -->
	{#if data.loadError}
		<aside class="entry entry-1 warn-banner" role="alert">
			{data.loadError}
			<span class="opacity-80"> — el backend desplegado no expone el endpoint de providers (revisar migración/schema en gt-core).</span>
		</aside>
	{/if}

	<!-- ── Global feedback ─────────────────────────────────────────────────── -->
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

	<!-- ── Callback URL ─────────────────────────────────────────────────────── -->
	<div class="entry entry-2 bezel">
		<div class="bezel-core px-[var(--gw-space-6)] py-[var(--gw-space-5)]">
			<div class="flex flex-wrap items-start justify-between gap-[var(--gw-space-4)]">
				<div class="min-w-0 flex-1 space-y-[var(--gw-space-2)]">
					<div class="flex items-center gap-[var(--gw-space-3)]">
						<div
							class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--gw-radius-lg)]
								border border-[var(--gw-color-border-subtle)] bg-[var(--gw-color-surface-3)]"
							aria-hidden="true"
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
								stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
								style="color: var(--gw-color-text-muted)">
								<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
								<path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
							</svg>
						</div>
						<div>
							<h2 class="text-[var(--gw-text-base)] font-semibold text-[var(--gw-color-text)]">
								Redirect URI
							</h2>
							<p class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
								Register this exact URL in the IdP console — a mismatch fails the OAuth exchange.
							</p>
						</div>
					</div>
					<code class="callback-code">{callbackUrl}</code>
				</div>
				<button type="button" class="btn-ghost flex-shrink-0" onclick={copyCallback}>
					{#if copied}
						<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
							stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="20 6 9 17 4 12"/>
						</svg>
						Copied
					{:else}
						<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
							stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
							<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
							<path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
						</svg>
						Copy
					{/if}
				</button>
			</div>
		</div>
	</div>

	<!-- ── Edit / Create form ───────────────────────────────────────────────── -->
	{#if editing}
		<!-- Edit mode -->
		<section class="entry entry-2 bezel" aria-label="Edit provider">
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
								Edit provider
							</h2>
							<p class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)]
								text-[var(--gw-color-text-muted)]">
								{editing.id}
							</p>
						</div>
					</div>
					<a href="/admin/providers" class="btn-ghost flex-shrink-0">Cancel</a>
				</div>

				<form
					method="POST"
					action="?/update"
					use:enhance={enhancer}
					class="max-w-2xl space-y-[var(--gw-space-4)]"
				>
					<input type="hidden" name="id" value={editing.id} />

					<div class="grid gap-[var(--gw-space-3)] sm:grid-cols-2">
						<div class="space-y-[var(--gw-space-1)]">
							<span class="field-label">Kind</span>
							<input class="gw-input" type="text" value={editing.kind} disabled />
						</div>
						<div class="space-y-[var(--gw-space-1)]">
							<label for="edit-display-name" class="field-label">Display name</label>
							<input
								id="edit-display-name"
								class="gw-input"
								type="text"
								name="display_name"
								required
								value={editing.display_name}
							/>
						</div>
						<div class="space-y-[var(--gw-space-1)]">
							<label for="edit-client-id" class="field-label">Client ID</label>
							<input
								id="edit-client-id"
								class="gw-input"
								type="text"
								name="client_id"
								required
								value={editing.client_id}
							/>
						</div>
						<div class="space-y-[var(--gw-space-1)]">
							<label for="edit-client-secret" class="field-label">
								Rotate client secret
								<span class="field-label-note">(leave empty to keep)</span>
							</label>
							<input
								id="edit-client-secret"
								class="gw-input"
								type="password"
								name="client_secret"
								autocomplete="off"
								placeholder="••••••••"
							/>
						</div>
					</div>

					{#if editNeedsEndpoints}
						<div class="endpoints-panel space-y-[var(--gw-space-3)]">
							<p class="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">
								Custom endpoints
							</p>
							<div class="grid gap-[var(--gw-space-3)]">
								{#each [
									{ id: 'edit-issuer', name: 'issuer', label: 'Issuer', value: editing.issuer },
									{ id: 'edit-authorize', name: 'authorize_endpoint', label: 'Authorize endpoint', value: editing.authorize_endpoint },
									{ id: 'edit-token', name: 'token_endpoint', label: 'Token endpoint', value: editing.token_endpoint },
									{ id: 'edit-userinfo', name: 'userinfo_endpoint', label: 'Userinfo endpoint', value: editing.userinfo_endpoint },
									{ id: 'edit-scopes', name: 'scopes', label: 'Scopes', value: editing.scopes, note: 'comma-separated' },
								] as f (f.id)}
									<div class="space-y-[var(--gw-space-1)]">
										<label for={f.id} class="field-label">
											{f.label}
											{#if f.note}<span class="field-label-note">({f.note})</span>{/if}
										</label>
										<input
											id={f.id}
											class="gw-input"
											type="text"
											name={f.name}
											value={f.value}
										/>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<label class="flex cursor-pointer items-center gap-[var(--gw-space-2)]">
						<input
							type="checkbox"
							class="gw-check"
							name="enabled"
							checked={editing.enabled}
						/>
						<span class="text-[var(--gw-text-sm)] text-[var(--gw-color-text)]">Enabled</span>
					</label>

					<button type="submit" class="cta" disabled={saving}>
						{#if saving}
							<svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"/>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
							</svg>
							<span>Saving…</span>
						{:else}
							<span>Save changes</span>
							<span class="cta-arrow" aria-hidden="true">→</span>
						{/if}
					</button>
				</form>

			</div>
		</section>

	{:else}
		<!-- Create mode -->
		<section class="entry entry-2 bezel" aria-label="Add provider">
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
						Add provider
					</h2>
				</div>

				<form
					method="POST"
					action="?/create"
					use:enhance={enhancer}
					class="max-w-2xl space-y-[var(--gw-space-4)]"
				>
					<div class="grid gap-[var(--gw-space-3)] sm:grid-cols-2">
						<div class="space-y-[var(--gw-space-1)]">
							<label for="create-kind" class="field-label">Kind</label>
							<select id="create-kind" class="gw-select" name="kind" bind:value={createKind}>
								{#each KINDS as k (k)}<option value={k}>{k}</option>{/each}
							</select>
						</div>
						<div class="space-y-[var(--gw-space-1)]">
							<label for="create-id" class="field-label">
								ID <span class="field-label-note">(slug, unique)</span>
							</label>
							<input
								id="create-id"
								class="gw-input"
								type="text"
								name="id"
								required
								placeholder="google"
							/>
						</div>
						<div class="space-y-[var(--gw-space-1)]">
							<label for="create-display-name" class="field-label">Display name</label>
							<input
								id="create-display-name"
								class="gw-input"
								type="text"
								name="display_name"
								required
								placeholder="Google"
							/>
						</div>
						<div class="space-y-[var(--gw-space-1)]">
							<label for="create-client-id" class="field-label">Client ID</label>
							<input
								id="create-client-id"
								class="gw-input"
								type="text"
								name="client_id"
								required
							/>
						</div>
						<div class="space-y-[var(--gw-space-1)] sm:col-span-2">
							<label for="create-client-secret" class="field-label">Client secret</label>
							<input
								id="create-client-secret"
								class="gw-input"
								type="password"
								name="client_secret"
								autocomplete="off"
								required
							/>
						</div>
					</div>

					{#if createNeedsEndpoints}
						<div class="endpoints-panel space-y-[var(--gw-space-3)]">
							<p class="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">
								Custom endpoints
							</p>
							<div class="grid gap-[var(--gw-space-3)]">
								{#each [
									{ id: 'create-issuer', name: 'issuer', label: 'Issuer', placeholder: 'https://idp.example.com' },
									{ id: 'create-authorize', name: 'authorize_endpoint', label: 'Authorize endpoint', placeholder: '' },
									{ id: 'create-token', name: 'token_endpoint', label: 'Token endpoint', placeholder: '' },
									{ id: 'create-userinfo', name: 'userinfo_endpoint', label: 'Userinfo endpoint', placeholder: '' },
									{ id: 'create-scopes', name: 'scopes', label: 'Scopes', placeholder: 'openid,email,profile', note: 'comma-separated' },
								] as f (f.id)}
									<div class="space-y-[var(--gw-space-1)]">
										<label for={f.id} class="field-label">
											{f.label}
											{#if f.note}<span class="field-label-note">({f.note})</span>{/if}
										</label>
										<input
											id={f.id}
											class="gw-input"
											type="text"
											name={f.name}
											required
											placeholder={f.placeholder}
										/>
									</div>
								{/each}
							</div>
						</div>
					{:else}
						<p class="text-[var(--gw-text-xs)] text-[var(--gw-color-text-muted)]">
							Endpoints for <span class="font-medium capitalize">{createKind}</span> are filled in automatically.
						</p>
					{/if}

					<button type="submit" class="cta" disabled={saving}>
						{#if saving}
							<svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"/>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
							</svg>
							<span>Creating…</span>
						{:else}
							<span>Create provider</span>
							<span class="cta-arrow" aria-hidden="true">→</span>
						{/if}
					</button>
				</form>

			</div>
		</section>
	{/if}

	<!-- ── Providers table ─────────────────────────────────────────────────── -->
	<section class="entry entry-3 bezel" aria-label="Providers list">
		<div class="bezel-core-overflow">
			{#if data.providers.length > 0}
				<table class="w-full text-left">
					<thead>
						<tr class="border-b border-[var(--gw-color-border-subtle)]">
							<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Name</th>
							<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Kind</th>
							<th class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)] sm:table-cell">ID</th>
							<th class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)] md:table-cell">Client ID</th>
							<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Enabled</th>
							<th class="px-[var(--gw-space-4)] py-[var(--gw-space-3)] text-right text-[10px] font-semibold
								uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-[var(--gw-color-border-subtle)]">
						{#each data.providers as p (p.id)}
							<tr class="data-row">
								<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
									<span class="text-[var(--gw-text-sm)] font-medium text-[var(--gw-color-text)]">
										{p.display_name}
									</span>
								</td>
								<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
									<span class="kind-chip">
										<span class="kind-glyph" aria-hidden="true">
											{KIND_GLYPHS[p.kind] ?? '⬡'}
										</span>
										{p.kind}
									</span>
								</td>
								<td class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] sm:table-cell">
									<span class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)]
										text-[var(--gw-color-text-muted)]">
										{p.id}
									</span>
								</td>
								<td class="hidden px-[var(--gw-space-4)] py-[var(--gw-space-3)] md:table-cell">
									<span class="font-[family-name:var(--gw-font-mono)] text-[var(--gw-text-xs)]
										text-[var(--gw-color-text-muted)]">
										{p.client_id}
									</span>
								</td>
								<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
									<form method="POST" action="?/toggle" use:enhance={enhancer}>
										<input type="hidden" name="id" value={p.id} />
										<input type="hidden" name="enabled" value={p.enabled ? 'false' : 'true'} />
										<button
											type="submit"
											class={p.enabled ? 'btn-toggle-on' : 'btn-toggle-off'}
											disabled={saving}
										>
											{#if p.enabled}
												<span class="h-1.5 w-1.5 rounded-full bg-current"></span>
											{/if}
											{p.enabled ? 'On' : 'Off'}
										</button>
									</form>
								</td>
								<td class="px-[var(--gw-space-4)] py-[var(--gw-space-3)]">
									<span class="flex items-center justify-end gap-[var(--gw-space-2)]">
										<a href="/admin/providers?edit={encodeURIComponent(p.id)}" class="btn-primary-sm">
											Edit
										</a>
										<form
											method="POST"
											action="?/delete"
											use:enhance={enhancer}
											onsubmit={(e) => {
												if (!confirm(`Delete provider ${p.id}? This cannot be undone.`)) e.preventDefault();
											}}
										>
											<input type="hidden" name="id" value={p.id} />
											<button type="submit" class="btn-danger" disabled={saving}>Delete</button>
										</form>
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<div
					class="flex flex-col items-center justify-center gap-[var(--gw-space-2)]
						px-[var(--gw-space-6)] py-[var(--gw-space-10)]"
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
						stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
						style="color: var(--gw-color-text-muted); opacity: 0.4" aria-hidden="true">
						<circle cx="12" cy="12" r="10"/>
						<line x1="12" y1="8" x2="12" y2="16"/>
						<line x1="8" y1="12" x2="16" y2="12"/>
					</svg>
					<p class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">No providers configured.</p>
				</div>
			{/if}
		</div>
	</section>

</div>
