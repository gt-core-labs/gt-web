<script lang="ts">
	import IconifyIcon from '@iconify/svelte';

	interface Props {
		/**
		 * Nombre del icono en formato Iconify / icons0.dev: `<colección>:<nombre>`.
		 * Ej: "lucide:bell", "heroicons:bell", "tabler:settings".
		 * Buscar en https://icons0.dev/
		 */
		icon: string;
		/** Tamaño en px (ancho = alto). Default 20 (equivale a h-5 w-5). */
		size?: number | string;
		class?: string;
	}

	let { icon, size = 20, class: cls = '' }: Props = $props();
</script>

<!--
  Neutro / sin color: Iconify renderiza los iconos monocromáticos con
  `currentColor`, así que heredan el color del texto del contexto. No fijar
  `fill`/`stroke` de color — el color lo decide la clase de texto del padre.
-->
<IconifyIcon {icon} width={size} height={size} class={cls} color="currentColor" aria-hidden="true" />
