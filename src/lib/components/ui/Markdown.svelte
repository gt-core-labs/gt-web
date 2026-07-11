<script lang="ts">
	import { marked, type MarkedExtension } from 'marked';
	import DOMPurify from 'isomorphic-dompurify';
	import { browser } from '$app/environment';

	// The system's single markdown render + sanitise point (gw-markdown-native.1).
	// Untrusted authors (agents, cross-tenant users) write `text`, so the parsed
	// HTML ALWAYS goes through DOMPurify before {@html}. Order is non-negotiable:
	// parse first, sanitise the resulting HTML, then inject — never inject raw
	// `text`. isomorphic-dompurify carries a jsdom DOM so this is safe under SSR.
	//
	// Mermaid support: fenced ```mermaid blocks are converted to
	// <pre class="mermaid">…</pre> by a custom marked extension; DOMPurify keeps
	// them (pre+text = safe). A client-side $effect runs mermaid.run() on mount
	// and whenever the html changes. mermaid.js is NOT imported during SSR.
	interface Props {
		/** Raw markdown source (may be null/empty — renders nothing). */
		text?: string | null;
		/** Extra classes appended to the prose container. */
		class?: string;
	}

	let { text = '', class: cls = '' }: Props = $props();
	let container: HTMLDivElement | undefined = $state();

	// Custom marked extension: convert ```mermaid fenced blocks into
	// <pre class="mermaid">…</pre> (same pattern as gt-docs rehypeMermaid).
	// The extension intercepts the `code` renderer so the raw mermaid source
	// survives DOMPurify (pre + text content is safe HTML).
	const mermaidRenderer: MarkedExtension = {
		renderer: {
			code({ text: code, lang }: { text: string; lang?: string }) {
				if (lang === 'mermaid') {
					// Escape HTML entities so DOMPurify doesn't strip angle brackets
					// in mermaid syntax (e.g. A-->B), and the mermaid runtime gets
					// clean source text after the browser decodes them.
					const escaped = code
						.replace(/&/g, '&amp;')
						.replace(/</g, '&lt;')
						.replace(/>/g, '&gt;');
					return `<pre class="mermaid">${escaped}</pre>`;
				}
				return false; // fall through to default renderer
			}
		}
	};

	marked.use(mermaidRenderer);

	// marked runs synchronously here (no async extensions); GFM is on by default.
	const html = $derived(
		text ? DOMPurify.sanitize(marked.parse(text, { async: false }) as string) : ''
	);

	// Client-side mermaid rendering: lazily import mermaid (heavy, ~2 MB) only
	// when we actually have <pre class="mermaid"> nodes to render. The import is
	// cached by the browser after the first load.
	$effect(() => {
		// Re-run whenever html changes (tracked by reading `html` above).
		const _ = html;
		if (!browser || !container) return;
		const nodes = container.querySelectorAll<HTMLElement>('pre.mermaid');
		if (!nodes.length) return;

		// Reset any previously-rendered mermaid output so re-renders work.
		// mermaid.run() replaces the text content with an SVG; on content change
		// we need to restore the source text for a fresh render.
		for (const node of nodes) {
			if (node.getAttribute('data-processed')) {
				node.removeAttribute('data-processed');
				// If mermaid already replaced the content with an SVG, restore
				// the original source from our data attribute.
				const src = node.getAttribute('data-mermaid-src');
				if (src) node.innerHTML = src;
			}
		}

		import('mermaid').then(({ default: mermaid }) => {
			// Stash source text before mermaid replaces it with SVG.
			for (const node of nodes) {
				if (!node.getAttribute('data-mermaid-src')) {
					node.setAttribute('data-mermaid-src', node.textContent ?? '');
				}
			}
			mermaid.initialize({
				startOnLoad: false,
				theme: 'dark',
				securityLevel: 'strict'
			});
			mermaid.run({ nodes: Array.from(nodes) });
		});
	});
</script>

{#if html}
	<div class="gw-prose {cls}" bind:this={container}>
		<!-- eslint-disable-next-line svelte/no-at-html-tags — sanitised above -->
		{@html html}
	</div>
{/if}
