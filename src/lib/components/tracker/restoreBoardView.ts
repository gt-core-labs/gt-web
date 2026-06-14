import { goto } from '$app/navigation';

/** View key → canonical board URL. Mirrors ViewSwitcher's VIEWS hrefs. */
const BOARD_VIEW_URL: Record<string, string> = {
	kanban: '/kanban',
	planning: '/planning',
	calendar: '/calendar?mode=month',
	timeline: '/calendar?mode=timeline'
};

/**
 * Restore the last board view picked via ViewSwitcher (gtweb-968172).
 *
 * ViewSwitcher writes the chosen view to `localStorage['gt:board-view']`, but the
 * board pages never read it back — so returning to /planning or /kanban after
 * picking Calendar/Timeline elsewhere in the SPA landed on the old view instead.
 *
 * Call this from an on-mount `$effect` with the current page's view key. If a
 * different view is remembered, redirect there with `replaceState` so history
 * stays clean and there's no visible flash of the wrong board.
 */
export function restoreBoardView(current: string): void {
	let target: string | undefined;
	try {
		const view = localStorage.getItem('gt:board-view');
		if (view && view !== current && BOARD_VIEW_URL[view]) target = BOARD_VIEW_URL[view];
	} catch {
		/* storage unavailable (private mode) */
	}
	if (target) goto(target, { replaceState: true });
}
