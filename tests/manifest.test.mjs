import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseCandidateBundleUrl, validateManifest } from '../scripts/validate-manifest.mjs';
const m = JSON.parse(readFileSync(new URL('../.ring/manifest.json', import.meta.url)));
test('candidate URL parser accepts only the closed namespace', () => {
  const url = `https://raw.githubusercontent.com/kody-w/openrappter/${'b'.repeat(40)}/candidates/${'a'.repeat(40)}/release/tag-djEuMTMuMA/${'c'.repeat(64)}.tar.gz`;
  assert.deepEqual(parseCandidateBundleUrl(url), { source: 'a'.repeat(40), sha: 'c'.repeat(64) });
  for (const invalid of [`${url}?x=1`, `${url}\n`, url.replace('/release/tag-djEuMTMuMA', ''), url.replace('/release/', '/release/extra/'), url.replace('tag-djEuMTMuMA', '..'), url.replace('raw.githubusercontent.com', 'example.com')]) assert.throws(() => parseCandidateBundleUrl(invalid));
});
test('current nightly pointer validates', () => validateManifest(m, 'nightly', new Date(Date.parse(m.promoted_at) + 60_000)));
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
  assert.match(workflow, /apply-request\.yml@813eafd957982e2c64d318caa12be3e494a1c7e4/);
  assert.match(workflow, /contents: write/);
  assert.ok(workflow.includes("request_sequence:\n        required: false\n        type: string\n        default: '0'"));
  assert.ok(workflow.includes("requested_sequence: ${{ inputs.request_sequence || '0' }}"));
});
