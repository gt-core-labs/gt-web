<script lang="ts">
	import { marked } from 'marked';
	import DOMPurify from 'isomorphic-dompurify';

	// The system's single markdown render + sanitise point (gw-markdown-native.1).
	// Untrusted authors (agents, cross-tenant users) write `text`, so the parsed
	// HTML ALWAYS goes through DOMPurify before {@html}. Order is non-negotiable:
	// parse first, sanitise the resulting HTML, then inject — never inject raw
	// `text`. isomorphic-dompurify carries a jsdom DOM so this is safe under SSR.
	interface Props {
		/** Raw markdown source (may be null/empty — renders nothing). */
		text?: string | null;
		/** Extra classes appended to the prose container. */
		class?: string;
	}

	let { text = '', class: cls = '' }: Props = $props();

	// marked runs synchronously here (no async extensions); GFM is on by default.
	const html = $derived(
		text ? DOMPurify.sanitize(marked.parse(text, { async: false }) as string) : ''
	);
</script>

{#if html}
	<div class="gw-prose {cls}">
		<!-- eslint-disable-next-line svelte/no-at-html-tags — sanitised above -->
		{@html html}
	</div>
{/if}
