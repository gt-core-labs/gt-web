import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv, type ProxyOptions } from 'vite';

export default defineConfig(({ mode }) => {
	// Dev backend the Vite proxy forwards browser requests to. Defaults to the
	// local backend; override per-developer with VITE_BACKEND_URL in a (gitignored)
	// .env so the committed config — and the container — stay untouched.
	const env = loadEnv(mode, process.cwd(), '');
	const BACKEND = env.VITE_BACKEND_URL || 'http://127.0.0.1:8765';

	// When the backend is a remote HTTPS host (e.g. gt.codecsrayo.com) it sets the
	// session cookies with Domain=<that host>, Secure and often SameSite=None. A
	// browser on http://localhost:5173 rejects all three, so the session never
	// sticks and login bounces. Rewrite Set-Cookie on the way back so the cookies
	// bind to localhost over http. No-op for a same-host local backend.
	const proxy = (): ProxyOptions => ({
		target: BACKEND,
		changeOrigin: true,
		cookieDomainRewrite: '',
		configure: (p) => {
			p.on('proxyRes', (proxyRes) => {
				const sc = proxyRes.headers['set-cookie'];
				if (sc)
					proxyRes.headers['set-cookie'] = sc.map((c) =>
						c
							.replace(/;\s*Domain=[^;]+/gi, '')
							.replace(/;\s*Secure/gi, '')
							.replace(/;\s*SameSite=None/gi, '; SameSite=Lax')
					);
			});
		}
	});

	return {
		plugins: [tailwindcss(), sveltekit()],
		server: {
			// Dev-only: proxy backend surfaces so cookies stay same-origin.
			// In prod Traefik routes these; here Vite forwards to the backend.
			proxy: {
				'/api': proxy(),
				'/auth': proxy(),
				'/stream': proxy(),
				'/openapi.json': proxy()
			}
		}
	};
});
