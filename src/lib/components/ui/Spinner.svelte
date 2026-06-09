<script lang="ts">
	// Token-driven loading spinner (gw-ui-redesign.3). Size is set via a CSS var so
	// callers can scale it without bespoke classes.
	interface Props {
		/** Diameter in rem. */
		size?: number;
		class?: string;
		/** Accessible label; rendered visually hidden. */
		label?: string;
	}

	let { size = 1.25, class: cls = '', label = 'Cargando' }: Props = $props();
</script>

<span
	role="status"
	class="gw-spinner inline-block shrink-0 rounded-[var(--gw-radius-full)] align-[-0.125em] {cls}"
	style="--gw-spinner-size: {size}rem"
>
	<span class="sr-only">{label}</span>
</span>

<style>
	.gw-spinner {
		width: var(--gw-spinner-size);
		height: var(--gw-spinner-size);
		border: 2px solid var(--gw-color-border-subtle);
		border-top-color: var(--gw-color-primary);
		animation: gw-spin var(--gw-duration-slow) linear infinite;
	}
	@keyframes gw-spin {
		to {
			transform: rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.gw-spinner {
			animation-duration: 1.5s;
		}
	}
</style>
