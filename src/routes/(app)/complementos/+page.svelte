<script lang="ts">
	import { page } from '$app/state';
	import { hasScope } from '$lib/api/auth';
	import { Card, Badge, Icon } from '$lib/ui';
	import { COMPLEMENTOS, type ComplementoStatus } from '$lib/complementos/manifest';

	const scopes = $derived(page.data.user?.scopes);

	const STATUS_LABEL: Record<ComplementoStatus, string> = {
		available: 'Available',
		beta: 'Beta',
		'coming-soon': 'Coming soon'
	};
	const STATUS_VARIANT: Record<ComplementoStatus, 'success' | 'warning' | 'surface'> = {
		available: 'success',
		beta: 'warning',
		'coming-soon': 'surface'
	};
	const statusLabel = (s: ComplementoStatus) => STATUS_LABEL[s];
	const statusVariant = (s: ComplementoStatus) => STATUS_VARIANT[s];
</script>

<div class="mx-auto max-w-5xl">
	<header class="mb-8">
		<h1 class="text-2xl font-semibold tracking-tight text-[var(--gw-color-text)]">Add-ons</h1>
		<p class="mt-1 text-sm text-[var(--gw-color-text-muted)]">
			Connect external services to your workspace. Each add-on brings its own configuration.
		</p>
	</header>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each COMPLEMENTOS as c (c.slug)}
			{@const locked = c.status === 'coming-soon' || !hasScope(scopes, c.scope)}
			<a
				href={locked ? undefined : `/complementos/${c.slug}`}
				aria-disabled={locked || undefined}
				class="block no-underline {locked ? 'pointer-events-none' : ''}"
			>
				<Card interactive={!locked} disabled={locked} class="h-full">
					<div class="flex items-start justify-between gap-3">
						<div
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl
								border border-[var(--gw-color-border)] bg-[var(--gw-color-surface-3)]
								text-[var(--gw-color-text)]"
						>
							<Icon icon={c.icon} size={20} />
						</div>
						<Badge variant={statusVariant(c.status)}>{statusLabel(c.status)}</Badge>
					</div>
					<h2 class="mt-3 text-base font-semibold text-[var(--gw-color-text)]">{c.name}</h2>
					<p class="mt-1 text-sm text-[var(--gw-color-text-muted)]">{c.description}</p>
				</Card>
			</a>
		{/each}
	</div>
</div>
