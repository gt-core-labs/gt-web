<script lang="ts">
	import type { Snippet } from 'svelte';

	// Inline status/error banner (gw-ui-redesign.3). Tonal fill + a left accent bar
	// keyed off the --gw-* semantic colour tokens. Errors/warnings announce via
	// role="alert"; info/success use role="status" so they are polite to AT.
	interface Props {
		variant?: 'error' | 'warning' | 'success' | 'info';
		class?: string;
		children: Snippet;
	}

	let { variant = 'info', class: cls = '', children }: Props = $props();

	const accent: Record<NonNullable<Props['variant']>, string> = {
		error: 'var(--gw-color-error)',
		warning: 'var(--gw-color-warning)',
		success: 'var(--gw-color-success)',
		info: 'var(--gw-color-primary)'
	};
	const glyph: Record<NonNullable<Props['variant']>, string> = {
		error: '✕',
		warning: '!',
		success: '✓',
		info: 'i'
	};
	const preset = {
		error: 'preset-tonal-error',
		warning: 'preset-tonal-warning',
		success: 'preset-tonal-success',
		info: 'preset-tonal-primary'
	} as const;
</script>

<div
	role={variant === 'error' || variant === 'warning' ? 'alert' : 'status'}
	class="flex items-start gap-[var(--gw-space-2)]
		rounded-[var(--gw-radius-md)] border-l-2
		px-[var(--gw-space-3)] py-[var(--gw-space-2)]
		text-[var(--gw-text-sm)] leading-[var(--gw-leading-snug)]
		{preset[variant]} {cls}"
	style="border-left-color: {accent[variant]}"
>
	<span
		aria-hidden="true"
		class="mt-px flex h-4 w-4 shrink-0 items-center justify-center
			rounded-[var(--gw-radius-full)] text-[0.65rem] font-bold leading-none text-white"
		style="background-color: {accent[variant]}"
	>{glyph[variant]}</span>
	<div class="flex-1">{@render children()}</div>
</div>
