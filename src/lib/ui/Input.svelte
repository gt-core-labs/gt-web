<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends HTMLInputAttributes {
		class?: string;
		/** Shows an error message and applies error border/ring. */
		error?: string;
		/** Two-way bound input value (`bind:value`). */
		value?: HTMLInputAttributes['value'];
	}

	// `value` is pulled out of the rest spread and declared $bindable so callers can
	// `bind:value`; everything else (placeholder, disabled, type, …) still flows
	// through `...rest`.
	let { class: cls = '', error, value = $bindable(), ...rest }: Props = $props();
</script>

<input
	class="input w-full
		transition-[border-color,box-shadow] duration-[var(--gw-duration-fast)]
		hover:border-[var(--gw-color-primary)]
		focus-visible:border-[var(--gw-color-primary)] focus-visible:outline-none
		focus-visible:ring-2 focus-visible:ring-[var(--gw-color-primary-focus)]/30
		disabled:cursor-not-allowed disabled:opacity-50
		{error ? '!border-[var(--gw-color-error)] focus-visible:!ring-[var(--gw-color-error)]/30' : ''}
		{cls}"
	aria-invalid={error ? 'true' : undefined}
	bind:value
	{...rest}
/>
{#if error}
	<p class="mt-1 text-[var(--gw-text-xs)] text-error-500">{error}</p>
{/if}
