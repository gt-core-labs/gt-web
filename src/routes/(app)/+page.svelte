<script lang="ts">
	import { Card, Badge } from '$lib/ui';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="space-y-6">
	<h1 class="h1">Welcome, {data.user?.sub}</h1>

	<Card>
		<header class="mb-2 flex items-center gap-2">
			<h2 class="h3">Session</h2>
			<Badge variant="success">authenticated</Badge>
		</header>
		<dl class="grid grid-cols-[8rem_1fr] gap-1 text-sm">
			<dt class="opacity-70">User</dt>
			<dd>{data.user?.sub}</dd>
			<dt class="opacity-70">Workspace</dt>
			<dd>{data.user?.workspace}</dd>
			<dt class="opacity-70">Scopes</dt>
			<dd class="flex flex-wrap gap-1">
				{#each data.user?.scopes ?? [] as s (s)}
					<Badge variant="primary">{s}</Badge>
				{/each}
			</dd>
		</dl>
	</Card>
</div>
