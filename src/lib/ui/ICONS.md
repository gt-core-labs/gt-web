# Iconos

La UI usa el primitivo [`Icon.svelte`](./Icon.svelte), un wrapper sobre
[`@iconify/svelte`](https://iconify.design/docs/icon-components/svelte/) que da
acceso al catálogo de [icons0.dev](https://icons0.dev/) (Iconify, 200k+ iconos,
150+ colecciones).

## Set base

La colección por defecto de la app es **lucide** (`lucide:*`): líneas finas,
monocromática, ideal para dashboard. Buscá iconos en https://icons0.dev/ y usá
el nombre en formato `colección:nombre`.

## Neutro / sin color

Los iconos son **neutros**: monocromáticos y heredan el color del texto vía
`currentColor`. No fijes `fill`/`stroke` de color en el icono — el color lo
decide la clase de texto del contenedor (ej. `text-error-500`, `opacity-70`).

## Uso

```svelte
<script lang="ts">
  import { Icon } from '$lib/ui';
</script>

<!-- tamaño por defecto: 20px -->
<Icon icon="lucide:bell" />

<!-- tamaño custom + hereda color del padre -->
<span class="text-error-500">
  <Icon icon="lucide:triangle-alert" size={16} />
</span>
```

| prop   | tipo             | default | nota                                  |
| ------ | ---------------- | ------- | ------------------------------------- |
| `icon` | `string`         | —       | `colección:nombre` (ej. `lucide:home`)|
| `size` | `number\|string` | `20`    | ancho = alto, en px                   |
| `class`| `string`         | `''`    | clases extra sobre el `<svg>`         |

## Agregar un icono nuevo

1. Buscalo en https://icons0.dev/ (preferí `lucide:` salvo que no exista ahí).
2. Usá `<Icon icon="lucide:<nombre>" />`. No hay que instalar nada por icono:
   `@iconify/svelte` resuelve el SVG on-demand.
3. Para color, envolvé/aplicá una clase de texto en el contenedor — nunca un
   color hardcodeado en el icono.
