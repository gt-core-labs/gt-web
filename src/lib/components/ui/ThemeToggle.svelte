<script lang="ts">
	import { theme } from '$lib/stores/theme.svelte';

	// Header control toggling light ↔ dark over the resolved scheme (hq-5c91d3).
	// Icon-only with a descriptive aria-label/title so the current mode is announced.
	const meta = {
		light: { glyph: '☀', label: 'Tema: claro' },
		dark: { glyph: '☾', label: 'Tema: oscuro' }
	} as const;
	const current = $derived(meta[theme.resolved]);
</script>

<button
	type="button"
	onclick={() => theme.cycle()}
	title={current.label}
	aria-label="{current.label} (clic para cambiar)"
	class="flex h-8 w-8 items-center justify-center rounded-[var(--gw-radius-md)]
		text-[var(--gw-text-base)] text-[var(--gw-color-text-muted)]
		transition-colors duration-[var(--gw-duration-fast)]
		hover:bg-[var(--gw-color-surface-3)] hover:text-[var(--gw-color-text)]
		focus-visible:outline-none focus-visible:ring-2
		focus-visible:ring-[var(--gw-color-primary-focus)] focus-visible:ring-offset-1"
>
	<span aria-hidden="true">{current.glyph}</span>
</button>
