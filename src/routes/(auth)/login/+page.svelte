<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button, Card } from '$lib/ui';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let loading = $state(false);
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
		</Card>
	</div>
</main>
