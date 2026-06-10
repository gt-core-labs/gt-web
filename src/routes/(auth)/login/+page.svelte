<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let loading = $state(false);

	const PROVIDER_GLYPHS: Record<string, string> = {
		google: 'G',
		github: '',
		microsoft: '⊞',
		oidc: '⬡'
	};
	const providerGlyph = (kind: string) => PROVIDER_GLYPHS[kind] ?? '⬡';
</script>

<style>
	/* Page-level tokens — mirrors `:root` light defaults so login is always legible
	   before the app shell (which sets data-theme-mode) is mounted. */
	:global(body) {
		background-color: oklch(0.97 0 0);
	}

	/* Entry — card slides in from below with a soft blur dissolve */
	@keyframes card-in {
		from { opacity: 0; transform: translateY(20px); }
		to   { opacity: 1; transform: translateY(0); }
	}
	.card-in {
		animation: card-in 560ms cubic-bezier(0.32, 0.72, 0, 1) both;
	}

	/* Field entry stagger */
	@keyframes fade-up-in {
		from { opacity: 0; transform: translateY(6px); }
		to   { opacity: 1; transform: translateY(0); }
	}
	.field   { animation: fade-up-in 400ms cubic-bezier(0.32, 0.72, 0, 1) both; }
	.field-1 { animation-delay: 120ms; }
	.field-2 { animation-delay: 170ms; }
	.field-3 { animation-delay: 220ms; }
	.field-4 { animation-delay: 280ms; }

	/* Double-Bezel — outer shell */
	.bezel {
		border-radius: var(--gw-radius-2xl);
		border: 1px solid var(--gw-color-border-subtle, oklch(0.922 0 0));
		background-color: var(--gw-color-surface-3, oklch(0.985 0 0));
		padding: 3px;
	}

	/* Double-Bezel — inner core */
	.bezel-core {
		border-radius: calc(var(--gw-radius-2xl) - 3px);
		background-color: var(--gw-color-surface, oklch(1 0 0));
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.8),
			0 24px 48px -12px rgba(0, 0, 0, 0.08),
			0 8px 16px -8px rgba(0, 0, 0, 0.04);
	}

	/* Logo mark */
	.logo-mark {
		border-radius: var(--gw-radius-xl, 0.75rem);
		background: linear-gradient(135deg, oklch(60% 0.22 250), oklch(50% 0.24 270));
		box-shadow:
			0 0 0 1px rgba(255,255,255,0.15) inset,
			0 8px 24px -4px oklch(60% 0.22 250 / 0.35);
	}

	/* Custom input — overrides Skeleton defaults for a tighter, premium feel */
	.gw-input {
		display: block;
		width: 100%;
		border-radius: var(--gw-radius-lg, 0.5rem);
		border: 1px solid var(--gw-color-border, oklch(0.922 0 0));
		background-color: var(--gw-color-surface-3, oklch(0.985 0 0));
		color: var(--gw-color-text, oklch(0.145 0 0));
		font-size: var(--gw-text-sm, 0.875rem);
		padding: 0.5rem 0.75rem;
		transition: border-color 160ms cubic-bezier(0.32, 0.72, 0, 1),
		            box-shadow   160ms cubic-bezier(0.32, 0.72, 0, 1);
		outline: none;
	}
	.gw-input:focus {
		border-color: var(--gw-color-primary, oklch(60% 0.22 250));
		box-shadow: 0 0 0 3px oklch(60% 0.22 250 / 0.12);
	}
	.gw-input::placeholder {
		color: var(--gw-color-text-muted, oklch(0.556 0 0));
		opacity: 0.6;
	}

	/* Primary CTA — pill with trailing arrow */
	.cta {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		border-radius: 9999px;
		border: none;
		background: linear-gradient(135deg, oklch(60% 0.22 250), oklch(50% 0.24 270));
		color: white;
		font-size: var(--gw-text-sm, 0.875rem);
		font-weight: var(--gw-font-semibold, 600);
		padding: 0.625rem 1.25rem;
		cursor: pointer;
		transition: opacity 200ms cubic-bezier(0.32, 0.72, 0, 1),
		            transform 200ms cubic-bezier(0.32, 0.72, 0, 1),
		            box-shadow 200ms cubic-bezier(0.32, 0.72, 0, 1);
		box-shadow: 0 4px 14px -2px oklch(60% 0.22 250 / 0.4);
	}
	.cta:hover:not(:disabled) {
		opacity: 0.92;
		box-shadow: 0 6px 20px -2px oklch(60% 0.22 250 / 0.5);
	}
	.cta:active:not(:disabled) {
		transform: scale(0.98);
	}
	.cta:disabled {
		cursor: not-allowed;
		opacity: 0.45;
	}
	.cta-arrow {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 9999px;
		background-color: rgba(255, 255, 255, 0.18);
		transition: transform 200ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.cta:hover:not(:disabled) .cta-arrow {
		transform: translateX(2px);
	}

	/* Provider button */
	.provider-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		border-radius: 9999px;
		border: 1px solid var(--gw-color-border, oklch(0.922 0 0));
		background-color: var(--gw-color-surface-3, oklch(0.985 0 0));
		color: var(--gw-color-text, oklch(0.145 0 0));
		font-size: var(--gw-text-sm, 0.875rem);
		font-weight: var(--gw-font-medium, 500);
		padding: 0.5rem 1rem;
		text-decoration: none;
		transition: border-color 160ms cubic-bezier(0.32, 0.72, 0, 1),
		            background-color 160ms cubic-bezier(0.32, 0.72, 0, 1),
		            box-shadow 160ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.provider-btn:hover {
		border-color: var(--gw-color-primary, oklch(60% 0.22 250));
		background-color: var(--gw-color-surface, oklch(1 0 0));
		box-shadow: 0 2px 8px -2px rgba(0, 0, 0, 0.06);
	}
	.provider-glyph {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 9999px;
		background-color: var(--gw-color-surface-3, oklch(0.985 0 0));
		border: 1px solid var(--gw-color-border-subtle, oklch(0.922 0 0));
		font-size: 0.65rem;
		font-weight: 700;
		line-height: 1;
	}

	/* Subtle background atmosphere */
	.bg-atmosphere {
		position: fixed;
		inset: 0;
		pointer-events: none;
		z-index: 0;
		background:
			radial-gradient(ellipse 60% 50% at 30% 20%, oklch(92% 0.04 250 / 0.6), transparent),
			radial-gradient(ellipse 50% 60% at 75% 80%, oklch(94% 0.03 200 / 0.4), transparent);
	}
</style>

<!-- Atmospheric background -->
<div class="bg-atmosphere" aria-hidden="true"></div>

<main class="relative z-10 flex min-h-[100dvh] items-center justify-center p-6">
	<div class="card-in w-full max-w-[360px]">
		<div class="bezel">
			<div class="bezel-core px-[var(--gw-space-8)] py-[var(--gw-space-8)]">

				<!-- Logo + headline -->
				<div class="mb-[var(--gw-space-8)] flex flex-col items-center gap-[var(--gw-space-4)] text-center">
					<div class="logo-mark flex h-11 w-11 items-center justify-center text-white">
						<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M12 2L2 7l10 5 10-5-10-5z"/>
							<path d="M2 17l10 5 10-5"/>
							<path d="M2 12l10 5 10-5"/>
						</svg>
					</div>
					<div>
						<span
							class="mb-2 inline-flex items-center rounded-full border border-[var(--gw-color-border-subtle,oklch(0.922_0_0))]
								bg-[var(--gw-color-surface-3,oklch(0.985_0_0))] px-[var(--gw-space-3)] py-[2px]
								text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--gw-color-text-muted,oklch(0.556_0_0))]"
						>
							Control Plane
						</span>
						<h1
							class="text-[var(--gw-text-2xl,1.5rem)] font-semibold leading-[var(--gw-leading-tight,1.25)]
								tracking-tight text-[var(--gw-color-text,oklch(0.145_0_0))]"
						>
							Sign in
						</h1>
					</div>
				</div>

				<!-- Form -->
				<form
					method="POST"
					use:enhance={() => {
						loading = true;
						return async ({ update }) => {
							await update();
							loading = false;
						};
					}}
					class="space-y-[var(--gw-space-3)]"
				>
					<input type="hidden" name="next" value={data.next} />

					<div class="field field-1 space-y-[var(--gw-space-1)]">
						<label
							for="login-email"
							class="block text-[10px] font-semibold uppercase tracking-[0.12em]
								text-[var(--gw-color-text-muted,oklch(0.556_0_0))]"
						>
							Email
						</label>
						<input
							id="login-email"
							class="gw-input"
							type="email"
							name="email"
							autocomplete="username"
							placeholder="you@example.com"
							required
							value={form?.email ?? ''}
						/>
					</div>

					<div class="field field-2 space-y-[var(--gw-space-1)]">
						<label
							for="login-password"
							class="block text-[10px] font-semibold uppercase tracking-[0.12em]
								text-[var(--gw-color-text-muted,oklch(0.556_0_0))]"
						>
							Password
						</label>
						<input
							id="login-password"
							class="gw-input"
							type="password"
							name="password"
							autocomplete="current-password"
							placeholder="••••••••"
							required
						/>
					</div>

					{#if form?.error}
						<p class="field field-3 rounded-[var(--gw-radius-md,0.375rem)] bg-[oklch(98%_0.02_25)]
							px-[var(--gw-space-3)] py-[var(--gw-space-2)]
							text-[var(--gw-text-xs,0.75rem)] text-[var(--gw-color-error,oklch(60%_0.24_25))]">
							{form.error}
						</p>
					{/if}

					<div class="field field-3 pt-[var(--gw-space-1)]">
						<button type="submit" class="cta" disabled={loading}>
							{#if loading}
								<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"/>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
								</svg>
								<span>Signing in…</span>
							{:else}
								<span>Sign in</span>
								<span class="cta-arrow" aria-hidden="true">→</span>
							{/if}
						</button>
					</div>
				</form>

				<!-- SSO providers -->
				{#if data.providers.length > 0}
					<div class="field field-4 my-[var(--gw-space-5)] flex items-center gap-3">
						<div class="h-px flex-1 bg-[var(--gw-color-border-subtle,oklch(0.922_0_0))]"></div>
						<span class="text-[10px] font-medium uppercase tracking-[0.1em]
							text-[var(--gw-color-text-muted,oklch(0.556_0_0))]">
							or continue with
						</span>
						<div class="h-px flex-1 bg-[var(--gw-color-border-subtle,oklch(0.922_0_0))]"></div>
					</div>

					<div class="field field-4 space-y-[var(--gw-space-2)]">
						{#each data.providers as p (p.id)}
							<a
								href={p.authorize_url}
								data-sveltekit-reload
								class="provider-btn"
								aria-label={`Sign in with ${p.display_name}`}
							>
								<span class="provider-glyph" aria-hidden="true">{providerGlyph(p.kind)}</span>
								<span>{p.display_name}</span>
							</a>
						{/each}
					</div>
				{/if}

			</div>
		</div>
	</div>
</main>
