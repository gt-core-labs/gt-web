/**
 * Tests for `normalizeModel` — the quota/analytics chart key.
 *
 * Run with the repo's built-in test runner (Node ≥ 23 type-stripping):
 *   npm test
 *
 * The contract that matters for the burn / by-model charts: every variant of a
 * Claude model — the new family-normalized form the quota source emits, the
 * legacy raw `claude-opus-4-8`, and the provider-decorated forms — must collapse
 * to the SAME family bucket, so a single model renders as one legend entry. See
 * `models.ts` for the design rationale (chart groups by family, not minor version).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeModel } from './models.ts';

test('family-normalized ids pass through unchanged', () => {
	assert.equal(normalizeModel('opus'), 'opus');
	assert.equal(normalizeModel('sonnet'), 'sonnet');
	assert.equal(normalizeModel('haiku'), 'haiku');
});

test('legacy raw claude-<family>-<ver> ids collapse to the family', () => {
	assert.equal(normalizeModel('claude-opus-4-8'), 'opus');
	assert.equal(normalizeModel('claude-sonnet-4-6'), 'sonnet');
});

test('dated snapshot ids collapse to the family', () => {
	assert.equal(normalizeModel('claude-haiku-4-5-20251001'), 'haiku');
	assert.equal(normalizeModel('claude-opus-4-8-20260101'), 'opus');
});

test('the new opus and the legacy claude-opus-4-8 land in one bucket', () => {
	// The whole point of the bead: source-normalized and legacy-raw must agree.
	assert.equal(normalizeModel('opus'), normalizeModel('claude-opus-4-8'));
});

test('provider-decorated claude ids collapse to the family', () => {
	assert.equal(normalizeModel('anthropic/claude-opus-4-8'), 'opus');
	assert.equal(normalizeModel('us.anthropic.claude-opus-4-8-v1:0'), 'opus');
	assert.equal(normalizeModel('claude-opus-4-8@20260101'), 'opus');
	assert.equal(
		normalizeModel('arn:aws:bedrock:us-east-1:123:inference-profile/us.anthropic.claude-sonnet-4-6'),
		'sonnet',
	);
});

test('unknown / non-Claude ids are preserved', () => {
	assert.equal(normalizeModel('gpt-4o'), 'gpt-4o');
	assert.equal(normalizeModel('llama-3-70b'), 'llama-3-70b');
	assert.equal(normalizeModel('some-future-model'), 'some-future-model');
});

test('empty / nullish input maps to unknown', () => {
	assert.equal(normalizeModel(''), 'unknown');
	assert.equal(normalizeModel('   '), 'unknown');
	assert.equal(normalizeModel(null), 'unknown');
	assert.equal(normalizeModel(undefined), 'unknown');
});
