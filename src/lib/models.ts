/**
 * Model-name normalization for the quota/analytics charts.
 *
 * `quota.tokens_sampled.v1` events carry whatever model string the calling runtime
 * reported, and that string is not stable across providers: the same logical model
 * arrives as a bare id from the Anthropic API, a routing-prefixed id from a gateway,
 * a versioned id from Bedrock, or a dated snapshot id. Grouping the burn / by-model
 * charts on the raw string therefore splits one model across several legend entries
 * and understates each band. `normalizeModel` collapses those variants to a single
 * canonical id so the charts aggregate correctly.
 *
 * Canonical id = the model FAMILY (`opus` / `sonnet` / `haiku`). This deliberately
 * matches the quota source (`gtcore-1f5112`), which already normalizes `quota.sample`
 * to the short family before it lands as a `tokens_sampled.v1` event. The render side
 * must agree with the source or the same model splits across two legend buckets: the
 * family-normalized `opus` (new samples) and the raw legacy `claude-opus-4-8` (older
 * samples) would otherwise stack as separate bands. The chart groups by family, not by
 * minor version — if `4-8` ever needs to be told apart from `4-7`, add that as a
 * separate dimension rather than re-splitting the family.
 *
 * Forms folded together (all → `opus`):
 *   - `opus`                                    (already family-normalized at source)
 *   - `claude-opus-4-8`                         (bare, legacy raw)
 *   - `claude-opus-4-8-20260101`                (Anthropic dated snapshot)
 *   - `anthropic/claude-opus-4-8`               (OpenRouter / gateway routing)
 *   - `us.anthropic.claude-opus-4-8-v1:0`       (Bedrock, with region + version)
 *   - `claude-opus-4-8@20260101`                (Vertex)
 *
 * Non-Claude ids (and Claude ids that don't match the `claude-<family>-…` shape) are
 * left as their prefix/date-stripped form, so the function is safe to apply to every
 * sample regardless of provider.
 */
export function normalizeModel(raw: string | null | undefined): string {
	let m = (raw ?? '').trim().toLowerCase();
	if (!m) return 'unknown';

	// Bedrock inference-profile ARNs: keep only the model id at the tail.
	// e.g. `arn:aws:bedrock:us-east-1:123:inference-profile/us.anthropic.claude-...`
	const slash = m.lastIndexOf('/');
	if (m.startsWith('arn:') && slash !== -1) m = m.slice(slash + 1);

	// Gateway routing prefixes: `anthropic/<id>`, `bedrock/<id>`, `openai/<id>`, …
	const provSlash = m.indexOf('/');
	if (provSlash !== -1) m = m.slice(provSlash + 1);

	// Region + vendor dotted prefixes: `us.anthropic.<id>`, `eu.anthropic.<id>`, `anthropic.<id>`.
	const dot = m.lastIndexOf('.');
	if (dot !== -1) m = m.slice(dot + 1);

	// Vertex pins the snapshot with `@YYYYMMDD`; Bedrock appends a `-v1:0` / `:0` version.
	m = m.replace(/@\d{6,8}$/, '');
	m = m.replace(/[-_]v\d+:\d+$/, '').replace(/:\d+$/, '');

	// Anthropic dated snapshots: trailing `-YYYYMMDD` (8 digits). Version segments like
	// the `4-8` in `claude-opus-4-8` are short, so an 8-digit anchor never touches them.
	m = m.replace(/-\d{8}$/, '');

	// Collapse `claude-<family>-…` ids to the bare family (`opus`/`sonnet`/`haiku`) — the
	// canonical the quota source already emits. This folds the legacy raw `claude-opus-4-8`
	// into the same bucket as the new family-normalized `opus`, instead of charting them as
	// two bands. Bare family ids (`opus`) and unknown models fall through unchanged.
	const family = m.match(/^claude-(opus|sonnet|haiku)-/);
	if (family) return family[1];

	return m || 'unknown';
}
