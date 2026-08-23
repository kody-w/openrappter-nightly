import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { validateManifest } from '../scripts/validate-manifest.mjs';
const m = JSON.parse(readFileSync(new URL('../.ring/manifest.json', import.meta.url)));
test('current nightly pointer validates', () => validateManifest(m, 'nightly', new Date('2026-08-23T20:00:00Z')));
test('closed contract rejects injected fields and repository', () => {
  assert.throws(() => validateManifest({ ...m, extra: true }, 'nightly'));
  assert.throws(() => validateManifest({ ...m, source: { ...m.source, repository: 'evil/repo' } }, 'nightly'));
});
test('future and incomplete published pointers fail', () => {
  assert.throws(() => validateManifest({ ...m, promoted_at: '2999-01-01T00:00:00Z' }, 'nightly'));
  assert.throws(() => validateManifest({ ...m, status: 'published', reason: null }, 'nightly'));
});
test('promotion receiver pulls immutable requests with only its GITHUB_TOKEN', () => {
  const workflow = readFileSync(new URL('../.github/workflows/apply-promotion.yml', import.meta.url), 'utf8');
  assert.doesNotMatch(workflow, /RING_AUTHORITY_TOKEN|repository_dispatch|secrets\./);
  assert.match(workflow, /apply-request\.yml@[0-9a-f]{40}/);
  assert.match(workflow, /contents: write/);
});
