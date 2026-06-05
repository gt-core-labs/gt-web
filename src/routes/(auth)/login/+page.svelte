<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button, Card } from '$lib/ui';
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
			<h1 class="h2 mb-1">gt-web</h1>
			<p class="mb-4 text-sm opacity-70">Sign in to the control plane.</p>

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
