/**
 * Manifest-driven catalog for the "Complementos" hub (`/complementos`).
 *
 * The hub renders one Card per entry in {@link COMPLEMENTOS}. Adding a future
 * complemento (Jira/Slack/GitLab) is a single-entry change: append a descriptor
 * here and its card appears — no edit to the hub page, the navbar, or any other
 * shell. The detail page lives at `/complementos/{slug}` and is the only extra
 * surface a new complemento needs.
 */

/** Lifecycle state of a complemento, drives the card badge. */
export type ComplementoStatus = 'available' | 'beta' | 'coming-soon';

/** A single complemento descriptor — the unit a new integration adds. */
export interface Complemento {
	/** URL slug — the card links to `/complementos/{slug}`. Unique. */
	slug: string;
	/** Display name shown on the card. */
	name: string;
	/** Iconify name (`<collection>:<name>`), e.g. `lucide:github`. */
	icon: string;
	/** One-line description rendered under the name. */
	description: string;
	/** Lifecycle state — renders a badge and (for coming-soon) disables the card. */
	status: ComplementoStatus;
	/**
	 * Scope a session must hold to act on this complemento. Cards whose scope the
	 * caller lacks are dimmed. The hub route itself is gated on `connection.read`.
	 */
	scope: string;
}

/**
 * The live catalog. Order here is the order on the page.
 *
 * GitHub is the first complemento; its detail/CRUD page is delivered separately
 * (bead hq-vcs-connections.6) — this shell only links to `/complementos/github`.
 */
export const COMPLEMENTOS: Complemento[] = [
	{
		slug: 'github',
		name: 'GitHub',
		icon: 'lucide:github',
		description: 'Connect a GitHub App and register private repos to index their graph.',
		status: 'available',
		scope: 'connection.read'
	}
];

/** Look up a single complemento by slug (used by the detail route). */
export function findComplemento(slug: string): Complemento | undefined {
	return COMPLEMENTOS.find((c) => c.slug === slug);
}
