/**
 * Tests for `domainsFromCatalog` — the closed Domain set the CreateIssueModal
 * selector is built from (gtweb-186fbf).
 *
 * Run with the repo's built-in test runner (Node ≥ 23 type-stripping):
 *   npm test
 *
 * The contract: the backend exposes `domain` as a JSON-Schema `definitions.Domain`
 * (a `oneOf` of single-value `enum` branches — schemars splits documented variants
 * into their own branch) on the `issues.create` tool. We must union EVERY branch so
 * a newly-registered domain shows up with no frontend edit, and return [] when the
 * catalog doesn't carry the definition (caller lacks `meta.read`). See `meta.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { domainsFromCatalog, type HelpTool } from './meta.ts';

/** A help catalog shaped like the real `issues.create` schema (trimmed). */
const catalog: HelpTool[] = [
	{
		name: 'issues.create',
		description: 'Create a bead.',
		inputSchema: {
			type: 'object',
			properties: {
				domain: { type: 'array', items: { $ref: '#/definitions/Domain' } }
			},
			definitions: {
				Domain: {
					oneOf: [
						{ type: 'string', enum: ['kernel.events', 'fe.web', 'fe.docs', 'meta.gap'] },
						{ type: 'string', enum: ['kernel.graphindex'], description: 'split variant' },
						{ type: 'string', enum: ['platform.skills'], description: 'another split variant' }
					]
				}
			}
		}
	}
];

test('unions every oneOf branch of the Domain definition', () => {
	assert.deepEqual(domainsFromCatalog(catalog), [
		'fe.docs',
		'fe.web',
		'kernel.events',
		'kernel.graphindex',
		'meta.gap',
		'platform.skills'
	]);
});

test('result is sorted and de-duplicated', () => {
	const dup: HelpTool[] = [
		{
			name: 'issues.create',
			description: '',
			inputSchema: {
				definitions: {
					Domain: {
						oneOf: [
							{ enum: ['fe.web', 'fe.docs'] },
							{ enum: ['fe.web'] } // duplicate across branches
						]
					}
				}
			}
		}
	];
	assert.deepEqual(domainsFromCatalog(dup), ['fe.docs', 'fe.web']);
});

test('handles a flat enum (no oneOf wrapper)', () => {
	const flat: HelpTool[] = [
		{
			name: 'issues.create',
			description: '',
			inputSchema: { definitions: { Domain: { type: 'string', enum: ['fe.web', 'store.pg'] } } }
		}
	];
	assert.deepEqual(domainsFromCatalog(flat), ['fe.web', 'store.pg']);
});

test('returns [] when no tool carries a Domain definition (e.g. no meta.read)', () => {
	assert.deepEqual(domainsFromCatalog([]), []);
	assert.deepEqual(
		domainsFromCatalog([{ name: 'help', description: '', inputSchema: { definitions: {} } }]),
		[]
	);
	assert.deepEqual(domainsFromCatalog([{ name: 'help', description: '' }]), []);
});
