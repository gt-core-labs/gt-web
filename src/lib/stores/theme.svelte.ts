// Theme preference store (gw-ui-redesign.5).
//
// Drives dark mode by setting `data-theme-mode="light"|"dark"` on <html>. The
// attribute is ALWAYS a concrete value: a 'system' preference is resolved to the
// OS scheme here in JS (and re-resolved live via a matchMedia listener). The CSS
// (src/lib/styles/tokens.css) keys all dark overrides off that attribute with
// explicit shades — we avoid `light-dark()` because the production CSS minifier
// downlevels it into an OS-only media query, which would make the toggle a no-op.
//
// The choice persists in localStorage under STORAGE_KEY. An inline <head> script
// in app.html applies the same resolved value before first paint (anti-FOUC);
// this store keeps the toggle reactive afterwards.

export type ThemeMode = 'light' | 'dark' | 'system';

export const STORAGE_KEY = 'gw-theme';
const MODES: ThemeMode[] = ['light', 'dark', 'system'];

function isMode(v: string | null): v is ThemeMode {
	return v === 'light' || v === 'dark' || v === 'system';
}

/** The OS scheme, used to resolve 'system'. */
function osScheme(): 'light' | 'dark' {
	return typeof window !== 'undefined' &&
		window.matchMedia('(prefers-color-scheme: dark)').matches
		? 'dark'
		: 'light';
}

/** Concrete scheme for a mode ('system' → current OS scheme). */
function resolve(mode: ThemeMode): 'light' | 'dark' {
	return mode === 'system' ? osScheme() : mode;
}

/** Write the resolved scheme to <html data-theme-mode>. */
function apply(mode: ThemeMode): void {
	if (typeof document === 'undefined') return;
	document.documentElement.setAttribute('data-theme-mode', resolve(mode));
}

class Theme {
	// Persisted preference. Defaults to 'system' until the stored value loads.
	mode = $state<ThemeMode>('system');
	#mql: MediaQueryList | null = null;

	/** Read the stored preference, apply it, and watch the OS while in 'system'. */
	init(): void {
		if (typeof localStorage !== 'undefined') {
			const stored = localStorage.getItem(STORAGE_KEY);
			this.mode = isMode(stored) ? stored : 'system';
		}
		apply(this.mode);

		// Re-resolve 'system' when the OS scheme changes.
		if (typeof window !== 'undefined' && !this.#mql) {
			this.#mql = window.matchMedia('(prefers-color-scheme: dark)');
			this.#mql.addEventListener('change', () => {
				if (this.mode === 'system') apply('system');
			});
		}
	}

	/** Set an explicit mode, persist it and apply it live. */
	set(mode: ThemeMode): void {
		this.mode = mode;
		if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, mode);
		apply(mode);
	}

	/** Cycle light → dark → system → light (drives the header toggle). */
	cycle(): void {
		this.set(MODES[(MODES.indexOf(this.mode) + 1) % MODES.length]);
	}
}

export const theme = new Theme();
