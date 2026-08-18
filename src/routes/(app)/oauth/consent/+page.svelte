<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<style>
	@keyframes fade-up-in {
		from { opacity: 0; transform: translateY(12px); }
		to   { opacity: 1; transform: translateY(0); }
	}

	.consent-card {
		animation: fade-up-in 500ms cubic-bezier(0.32, 0.72, 0, 1) both;
		border-radius: var(--gw-radius-2xl);
		border: 1px solid var(--gw-color-border-subtle);
		background-color: var(--gw-color-surface-3);
		padding: 3px;
		max-width: 28rem;
		margin: 0 auto;
	}
	.consent-inner {
		border-radius: calc(var(--gw-radius-2xl) - 3px);
		background-color: var(--gw-color-surface);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
		padding: var(--gw-space-8) var(--gw-space-6);
	}

	.app-icon {
		display: flex; align-items: center; justify-content: center;
		width: 3.5rem; height: 3.5rem; border-radius: var(--gw-radius-xl);
		border: 1px solid var(--gw-color-border-subtle);
		background-color: var(--gw-color-surface-3);
		margin: 0 auto var(--gw-space-4);
	}

	.scope-pill {
		display: inline-flex; align-items: center;
		border-radius: 9999px;
		background-color: var(--gw-color-surface-3);
		border: 1px solid var(--gw-color-border-subtle);
		font-size: 11px; font-weight: 600; padding: 3px 10px;
		font-family: var(--gw-font-mono);
		color: var(--gw-color-text-muted);
	}

	.btn-approve {
		display: flex; align-items: center; justify-content: center; gap: 0.5rem;
		width: 100%; border-radius: 9999px; border: none;
		background: linear-gradient(135deg, oklch(60% 0.22 250), oklch(50% 0.24 270));
		color: white; font-size: var(--gw-text-sm); font-weight: 600;
		padding: 0.625rem 1.25rem; cursor: pointer;
		transition: opacity 200ms cubic-bezier(0.32, 0.72, 0, 1),
		            box-shadow 200ms cubic-bezier(0.32, 0.72, 0, 1);
		box-shadow: 0 4px 14px -2px oklch(60% 0.22 250 / 0.35);
	}
	.btn-approve:hover { opacity: 0.92; box-shadow: 0 6px 20px -2px oklch(60% 0.22 250 / 0.45); }
	.btn-approve:active { transform: scale(0.98); }

	.btn-deny {
		display: flex; align-items: center; justify-content: center;
		width: 100%; border-radius: 9999px;
		border: 1px solid var(--gw-color-border);
		background-color: var(--gw-color-surface-3);
		color: var(--gw-color-text-muted);
		font-size: var(--gw-text-sm); font-weight: 500;
		padding: 0.5625rem 1.25rem; cursor: pointer;
		transition: border-color 150ms cubic-bezier(0.32, 0.72, 0, 1),
		            background-color 150ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.btn-deny:hover { border-color: var(--gw-color-text-muted); background-color: var(--gw-color-surface); }
	.btn-deny:active { transform: scale(0.97); }

	.user-badge {
		display: inline-flex; align-items: center; gap: 6px;
		border-radius: 9999px;
		background-color: var(--gw-color-surface-3);
		border: 1px solid var(--gw-color-border-subtle);
		font-size: 11px; font-weight: 500; padding: 3px 10px;
		color: var(--gw-color-text-muted);
	}
</style>

<div class="flex min-h-[60vh] items-center justify-center px-4">
	<div class="consent-card">
		<div class="consent-inner text-center">

			<!-- App icon -->
			<div class="app-icon">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
					stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
					style="color: var(--gw-color-text-muted)">
					<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
					<path d="M7 11V7a5 5 0 0110 0v4"/>
				</svg>
			</div>

			<!-- Title -->
			<h1 class="text-[var(--gw-text-xl)] font-semibold text-[var(--gw-color-text)]">
				Authorize access
			</h1>
			<p class="mt-[var(--gw-space-2)] text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">
				<span class="font-semibold text-[var(--gw-color-text)]">{data.client_name}</span>
				wants to access your account.
			</p>

			<!-- User info -->
			<div class="mt-[var(--gw-space-4)] flex justify-center">
				<span class="user-badge">
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
						stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
						<circle cx="12" cy="7" r="4"/>
					</svg>
					{data.user_sub}
					{#if data.user_workspace}
						<span style="opacity: 0.5">@</span>{data.user_workspace}
					{/if}
				</span>
			</div>

			<!-- Scopes -->
			{#if data.scopes.length > 0}
				<div class="mt-[var(--gw-space-5)]">
					<p class="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gw-color-text-muted)]">
						Permissions requested
					</p>
					<div class="mt-[var(--gw-space-2)] flex flex-wrap justify-center gap-[var(--gw-space-2)]">
						{#each data.scopes as scope}
							<span class="scope-pill">{scope}</span>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Buttons -->
			<div class="mt-[var(--gw-space-6)] space-y-[var(--gw-space-3)]">
				<!-- Approve -->
				<form method="POST" action="/oauth/authorize">
					<input type="hidden" name="client_id" value={data.client_id} />
					<input type="hidden" name="redirect_uri" value={data.redirect_uri} />
					<input type="hidden" name="code_challenge" value={data.code_challenge} />
					<input type="hidden" name="code_challenge_method" value={data.code_challenge_method} />
					<input type="hidden" name="state" value={data.state} />
					<input type="hidden" name="approved" value="true" />
					<button type="submit" class="btn-approve">
						Approve
					</button>
				</form>

				<!-- Deny -->
				<form method="POST" action="/oauth/authorize">
					<input type="hidden" name="client_id" value={data.client_id} />
					<input type="hidden" name="redirect_uri" value={data.redirect_uri} />
					<input type="hidden" name="code_challenge" value={data.code_challenge} />
					<input type="hidden" name="code_challenge_method" value={data.code_challenge_method} />
					<input type="hidden" name="state" value={data.state} />
					<input type="hidden" name="approved" value="false" />
					<button type="submit" class="btn-deny">
						Deny
					</button>
				</form>
			</div>

			<p class="mt-[var(--gw-space-4)] text-[10px] text-[var(--gw-color-text-muted)]" style="opacity: 0.6">
				Authorizing will redirect you to the application.
			</p>

		</div>
	</div>
</div>
