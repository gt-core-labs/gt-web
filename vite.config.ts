import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		// Dev-only: proxy backend surfaces so cookies stay same-origin.
		// In prod Traefik routes these; here Vite forwards to the local backend.
		proxy: {
			'/api': { target: 'http://127.0.0.1:8765', changeOrigin: true },
			'/auth': { target: 'http://127.0.0.1:8765', changeOrigin: true },
			'/stream': { target: 'http://127.0.0.1:8765', changeOrigin: true },
			'/openapi.json': { target: 'http://127.0.0.1:8765', changeOrigin: true }
		}
	}
});
