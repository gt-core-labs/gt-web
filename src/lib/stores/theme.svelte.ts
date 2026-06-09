// Theme preference store (gw-ui-redesign.5).
//
// Drives dark mode by setting the document's CSS `color-scheme`, which Skeleton's
// `light-dark()` palette vars and our --gw-* surface/text/border tokens both read
// from. Three modes:
//   - 'light'  → force the light scheme
//   - 'dark'   → force the dark scheme
//   - 'system' → defer to the OS (clear the inline override so Skeleton's base
//                `@media (prefers-color-scheme)` rule wins)
//
// The choice persists in localStorage under STORAGE_KEY. An inline <head> script
// in app.html applies the same value before first paint to avoid a flash of the
// wrong theme (FOUC); this store keeps the toggle reactive afterwards.

export type ThemeMode = 'light' | 'dark' | 'system';

export const STORAGE_KEY = 'gw-theme';
const MODES: ThemeMode[] = ['light', 'dark', 'system'];

function isMode(v: string | null): v is ThemeMode {
	return v === 'light' || v === 'dark' || v === 'system';
}

/** Apply a mode to <html> by setting (or clearing) the inline color-scheme. */
function applyColorScheme(mode: ThemeMode): void {
	if (typeof document === 'undefined') return;
	const root = document.documentElement;
	// 'system' clears the inline override so the stylesheet's prefers-color-scheme
	// media rule drives the scheme again.
	root.style.colorScheme = mode === 'system' ? '' : mode;
}

class Theme {
	// Persisted preference. Defaults to 'system' until the stored value loads.
	mode = $state<ThemeMode>('system');

	/** Read the stored preference and apply it. Call once on the client (layout onMount). */
	init(): void {
		if (typeof localStorage === 'undefined') return;
		const stored = localStorage.getItem(STORAGE_KEY);
		this.mode = isMode(stored) ? stored : 'system';
		applyColorScheme(this.mode);
	}

	/** Set an explicit mode, persist it and apply it live. */
	set(mode: ThemeMode): void {
		this.mode = mode;
		if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, mode);
		applyColorScheme(mode);
	}

	/** Cycle light → dark → system → light (drives the header toggle). */
	cycle(): void {
		const next = MODES[(MODES.indexOf(this.mode) + 1) % MODES.length];
		this.set(next);
	}
}

export const theme = new Theme();
