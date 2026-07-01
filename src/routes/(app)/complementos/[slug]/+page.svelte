<script lang="ts">
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { Card, Badge, Icon } from '$lib/ui';
	import { findComplemento } from '$lib/complementos/manifest';

	const slug = $derived(page.params.slug ?? '');
	const complemento = $derived(slug ? findComplemento(slug) : undefined);
</script>

<div class="mx-auto max-w-3xl">
	<a
		href="{base}/complementos"
		class="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--gw-color-text-muted)]
			no-underline transition-colors hover:text-[var(--gw-color-text)]"
	>
		<Icon icon="lucide:arrow-left" size={15} />
		Complementos
	</a>

	{#if complemento}
		<header class="mb-6 flex items-start gap-4">
			<div
				class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl
					border border-[var(--gw-color-border)] bg-[var(--gw-color-surface-3)]
					text-[var(--gw-color-text)]"
			>
				<Icon icon={complemento.icon} size={24} />
			</div>
			<div class="min-w-0">
				<h1 class="text-2xl font-semibold tracking-tight text-[var(--gw-color-text)]">
					{complemento.name}
				</h1>
				<p class="mt-1 text-sm text-[var(--gw-color-text-muted)]">{complemento.description}</p>
			</div>
		</header>

		<Card>
			<div class="flex items-center gap-2">
				<Badge variant="warning">Pendiente</Badge>
				<span class="text-sm font-medium text-[var(--gw-color-text)]">Próximamente</span>
			</div>
			<p class="mt-2 text-sm text-[var(--gw-color-text-muted)]">
				La configuración de este complemento aún no está disponible. Su pantalla de detalle se
				entrega por separado.
			</p>
		</Card>
	{:else}
		<Card>
			<h1 class="text-base font-semibold text-[var(--gw-color-text)]">
				Complemento no encontrado
			</h1>
			<p class="mt-1 text-sm text-[var(--gw-color-text-muted)]">
				No existe un complemento con el identificador <code>{slug}</code>.
			</p>
		</Card>
	{/if}
</div>
