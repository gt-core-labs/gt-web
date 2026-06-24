/**
 * Tests for the domain-catalog parsing helpers (gtweb-855bac) — the shape the
 * `/system` admin table renders and the CreateIssueModal selector is built from.
 *
 * Run with the repo's built-in test runner (Node ≥ 23 type-stripping):
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseDomainCatalog, enabledDomainKeys } from './domain.ts';

test('parses the bare array the backend returns', () => {
	const raw = [
		{ key: 'producto', label: 'Producto', tier: null, enabled: true, reserved: false },
		{ key: 'meta.gap', label: 'meta.gap', tier: 'meta', enabled: true, reserved: true }
	];
	assert.deepEqual(parseDomainCatalog(raw), raw);
});

test('unwraps a {domains|catalog|entries} envelope', () => {
	const entry = { key: 'fe.web', label: 'fe.web', tier: 'fe', enabled: true, reserved: false };
	assert.deepEqual(parseDomainCatalog({ domains: [entry] }), [entry]);
	assert.deepEqual(parseDomainCatalog({ catalog: [entry] }), [entry]);
	assert.deepEqual(parseDomainCatalog({ entries: [entry] }), [entry]);
});

test('defaults label to the key, tier to null, enabled to true', () => {
	assert.deepEqual(parseDomainCatalog([{ key: 'producto' }]), [
		{ key: 'producto', label: 'producto', tier: null, enabled: true, reserved: false }
	]);
});

test('drops malformed rows (no string key) instead of throwing', () => {
	const raw = [{ key: 'ok' }, { label: 'no key' }, null, 42, { key: '' }];
	assert.deepEqual(parseDomainCatalog(raw), [
		{ key: 'ok', label: 'ok', tier: null, enabled: true, reserved: false }
	]);
});

test('returns [] for a non-array, non-enveloped body (e.g. a 403 text)', () => {
	assert.deepEqual(parseDomainCatalog(undefined), []);
	assert.deepEqual(parseDomainCatalog(null), []);
	assert.deepEqual(parseDomainCatalog('forbidden'), []);
	assert.deepEqual(parseDomainCatalog({}), []);
});

test('enabledDomainKeys returns enabled keys, sorted', () => {
	const entries = parseDomainCatalog([
		{ key: 'orch.merge', enabled: true },
		{ key: 'fe.web', enabled: true },
		{ key: 'legacy', enabled: false },
		{ key: 'meta.gap', enabled: true, reserved: true }
	]);
	assert.deepEqual(enabledDomainKeys(entries), ['fe.web', 'meta.gap', 'orch.merge']);
});
