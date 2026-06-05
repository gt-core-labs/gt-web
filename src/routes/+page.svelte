<script lang="ts">
	import { Card, Badge, Button } from '$lib/ui';
</script>

<main class="mx-auto max-w-3xl space-y-6 p-8">
	<h1 class="h1">gt-web</h1>
	<p class="opacity-80">
		SvelteKit SSR control plane for gt-core. Foundation up — auth, shell and feature
		modules land in the following beads.
	</p>

	<Card>
		<header class="mb-2 flex items-center gap-2">
			<h2 class="h3">Foundation</h2>
			<Badge variant="success">ready</Badge>
		</header>
		<ul class="list-disc space-y-1 pl-6 text-sm opacity-80">
			<li>adapter-node SSR + Tailwind 4 + Skeleton theme</li>
			<li>typed <code>/api/v1/*</code> client (openapi-fetch, codegen)</li>
			<li>hand-written <code>/auth/*</code> client + scope helper</li>
		</ul>
		<footer class="mt-3">
			<Button variant="tonal" disabled>Sign in (hq-gtweb.2)</Button>
		</footer>
	</Card>
</main>
