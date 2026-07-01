import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		// SSR behind the same-origin Traefik proxy (gt.codecsrayo.com). The
		// documentation site (gt-docs) owns `/`, so the console is served under
		// `/app`. Every in-app link must go through `base` from `$app/paths`;
		// backend calls (`/api`, `/auth`) stay unprefixed (Traefik routes them).
		// `relative: false` → assets emitted as absolute `/app/_app/…` (not page-
		// relative), which is unambiguous behind the Traefik base-path routing.
		paths: { base: '/app', relative: false },
		adapter: adapter()
	}
};

export default config;
