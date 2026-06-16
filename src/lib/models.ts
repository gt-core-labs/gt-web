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
 * Forms folded together (all → `claude-opus-4-8`):
 *   - `claude-opus-4-8`                         (bare)
 *   - `claude-opus-4-8-20260101`                (Anthropic dated snapshot)
 *   - `anthropic/claude-opus-4-8`               (OpenRouter / gateway routing)
 *   - `us.anthropic.claude-opus-4-8-v1:0`       (Bedrock, with region + version)
 *   - `claude-opus-4-8@20260101`                (Vertex)
 *
 * Non-Claude ids are handled the same way (prefix + date/version stripping) so the
 * function is safe to apply to every sample regardless of provider — including ids whose
 * version carries a dot (`gpt-4.1`, `gemini-1.5-pro`, `llama3.1-70b`), which are preserved
 * intact rather than truncated at the dot.
 */
/**
 * Leading dotted segments that a Bedrock cross-region inference profile prefixes onto the
 * model id — a region (`us.`, `eu.`, …) and/or a vendor (`anthropic.`, `meta.`, …). Only
 * these are stripped; any other dot belongs to the model id itself (a version like `4.1`).
 */
const DOT_PREFIXES = new Set([
	// Bedrock regions
	'us', 'eu', 'apac', 'ap', 'sa', 'ca', 'me', 'af', 'global', 'us-gov',
	// vendors
	'anthropic', 'amazon', 'meta', 'mistral', 'cohere', 'ai21', 'deepseek',
	'stability', 'stabilityai', 'google', 'openai', 'qwen', 'writer', 'luma', 'twelvelabs',
]);

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
	// Strip only *recognized* leading region/vendor segments — a blind `lastIndexOf('.')`
	// would also eat the dot inside a versioned id (`gpt-4.1`, `gemini-1.5-pro`,
	// `llama3.1-70b`), collapsing distinct models onto the same band and mis-attributing
	// their tokens. Walk leading `<segment>.` runs only while the segment is a known prefix.
	let cut: number;
	while ((cut = m.indexOf('.')) !== -1 && DOT_PREFIXES.has(m.slice(0, cut))) m = m.slice(cut + 1);

	// Vertex pins the snapshot with `@YYYYMMDD`; Bedrock appends a `-v1:0` / `:0` version.
	m = m.replace(/@\d{6,8}$/, '');
	m = m.replace(/[-_]v\d+:\d+$/, '').replace(/:\d+$/, '');

	// Anthropic dated snapshots: trailing `-YYYYMMDD` (8 digits). Version segments like
	// the `4-8` in `claude-opus-4-8` are short, so an 8-digit anchor never touches them.
	m = m.replace(/-\d{8}$/, '');

	return m || 'unknown';
}
