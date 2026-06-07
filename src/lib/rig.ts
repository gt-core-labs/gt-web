/**
 * Active-rig context — the rig the shell is currently scoped to.
 *
 * A rig is a repo catalog entry (gt-rig); "selecting" one is a pure UI preference
 * that contextualises views (tracker filters to its bead `prefix`, the spawn form
 * defaults to it). Unlike the workspace, it carries no auth weight, so it lives in
 * a plain (non-httpOnly) cookie the browser sets directly and SSR reads back via
 * `event.cookies` — no backend round-trip. Empty / unset ⇒ "all rigs".
 */
export const RIG_COOKIE = 'gt_rig';

/** Browser: persist the active rig (empty string clears it) and let callers reload. */
export function setActiveRig(name: string): void {
	const value = encodeURIComponent(name);
	// 1y; Lax + Path=/ so every route's SSR load sees it on the next request.
	const maxAge = name ? 60 * 60 * 24 * 365 : 0;
	document.cookie = `${RIG_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

/**
 * True when `beadId` belongs to `prefix` (a rig's bead prefix, e.g. `hq`).
 * Bead ids are `<prefix>-<slug>` (e.g. `hq-agent-observability`); an empty prefix
 * matches everything (the "all rigs" view).
 */
export function beadInRig(beadId: string, prefix: string | undefined): boolean {
	if (!prefix) return true;
	return beadId === prefix || beadId.startsWith(`${prefix}-`) || beadId.startsWith(`${prefix}.`);
}
