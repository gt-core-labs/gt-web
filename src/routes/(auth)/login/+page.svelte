<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button, Card, Icon } from '$lib/ui';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let loading = $state(false);

	// A glyph per provider kind; generic `oidc` (and anything unknown) falls back.
	const PROVIDER_ICONS: Record<string, string> = {
		google: 'G',
		github: '',
		microsoft: '⊞',
		oidc: '🔑'
	};
	const providerIcon = (kind: string) => PROVIDER_ICONS[kind] ?? '🔑';
</script>

<main class="flex min-h-screen items-center justify-center p-6">
	<div class="w-full max-w-sm">
		<Card>
			<div class="mb-4 flex flex-col items-center gap-[var(--gw-space-2)] text-center">
				<span
					class="flex h-12 w-12 items-center justify-center rounded-[var(--gw-radius-lg)]
						bg-[var(--gw-color-primary)] text-white shadow-[var(--gw-shadow-md)]"
				>
					<Icon icon="lucide:user" size={24} />
				</span>
				<p class="text-[var(--gw-text-sm)] text-[var(--gw-color-text-muted)]">
					Sign in to the control plane.
				</p>
			</div>

			<form
				method="POST"
				use:enhance={() => {
					loading = true;
					return async ({ update }) => {
						await update();
						loading = false;
					};
				}}
				class="space-y-3"
			>
				<input type="hidden" name="next" value={data.next} />

				<label class="label">
					<span class="label-text">Email</span>
					<input
						class="input"
						type="email"
						name="email"
						autocomplete="username"
						required
						value={form?.email ?? ''}
					/>
				</label>

				<label class="label">
					<span class="label-text">Password</span>
					<input
						class="input"
						type="password"
						name="password"
						autocomplete="current-password"
						required
					/>
				</label>

				{#if form?.error}
					<p class="text-sm text-error-500">{form.error}</p>
				{/if}

				<Button type="submit" class="w-full" disabled={loading}>
					{loading ? 'Signing in…' : 'Sign in'}
				</Button>
			</form>

			{#if data.providers.length > 0}
				<div class="my-4 flex items-center gap-3 text-xs opacity-50">
					<hr class="flex-1 border-surface-500/30" />
					<span>or</span>
					<hr class="flex-1 border-surface-500/30" />
				</div>

				<!--
					Each provider link is a plain full-page anchor to the backend's relative
					authorize_url — NOT a fetch/XHR — so the browser follows the 302 to the
					IdP. The backend's /auth/callback lands the session via httpOnly cookies.
				-->
				<div class="space-y-2">
					{#each data.providers as p (p.id)}
						<a
							href={p.authorize_url}
							data-sveltekit-reload
							class="btn w-full preset-tonal-surface"
							aria-label={`Sign in with ${p.display_name}`}
						>
							<span aria-hidden="true" class="font-bold">{providerIcon(p.kind)}</span>
							<span>Sign in with {p.display_name}</span>
						</a>
					{/each}
				</div>
			{/if}
		</Card>
	</div>
</main>
