import type { Cookies } from '@sveltejs/kit';

/**
 * Re-emit backend Set-Cookie headers onto the SvelteKit response.
 *
 * The Rust backend owns the httpOnly session cookies (gt_web_token, gt_refresh).
 * When SSR calls /auth/login or /auth/refresh through `event.fetch`, those
 * Set-Cookie headers do NOT auto-propagate to the browser — we parse and replay
 * them via `event.cookies` so the same attributes (path/maxAge/httpOnly/...) ride
 * back to the client, and so subsequent `event.fetch` in the same request sees
 * the refreshed token.
 */
export function relaySetCookies(setCookies: string[], cookies: Cookies): void {
	for (const raw of setCookies) {
		const segments = raw.split(';').map((s) => s.trim());
		const first = segments.shift();
		if (!first) continue;
		const eq = first.indexOf('=');
		if (eq < 0) continue;
		const name = first.slice(0, eq);
		const value = first.slice(eq + 1);

		const opts: Parameters<Cookies['set']>[2] = { path: '/' };
		for (const seg of segments) {
			const [k, v] = seg.split('=');
			switch (k.toLowerCase()) {
				case 'path':
					opts.path = v ?? '/';
					break;
				case 'max-age':
					opts.maxAge = Number.parseInt(v, 10);
					break;
				case 'domain':
					opts.domain = v;
					break;
				case 'expires':
					opts.expires = new Date(v);
					break;
				case 'samesite':
					opts.sameSite = v?.toLowerCase() as 'lax' | 'strict' | 'none';
					break;
				case 'httponly':
					opts.httpOnly = true;
					break;
				case 'secure':
					opts.secure = true;
					break;
			}
		}
		// `value` arrives already cookie-encoded from the backend; keep it verbatim.
		cookies.set(name, value, { ...opts, encode: (x) => x });
	}
}
