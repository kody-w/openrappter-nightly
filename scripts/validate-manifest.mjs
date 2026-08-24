#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const rings = ['nightly', 'alpha', 'canary', 'beta', 'stable'];
const top = ['artifact', 'channel_version', 'intended_release_tag', 'predecessor', 'promoted_at', 'promotion_id', 'reason', 'receipt', 'ring', 'schema', 'source', 'status', 'version'];
const sourceKeys = ['commit', 'repository', 'tag'];
const artifactKeys = ['install_url', 'provenance', 'sha256', 'url'];
const hosts = new Set(['github.com', 'registry.npmjs.org', 'raw.githubusercontent.com']);
const fail = (message) => { throw new Error(message); };
export const parseCandidateBundleUrl = value => {
  const u=new URL(value); if(!/^[\x20-\x7e]+$/.test(value)||!value.startsWith('https://raw.githubusercontent.com/')||u.protocol!=='https:'||u.hostname!=='raw.githubusercontent.com'||u.username||u.password||u.port||u.search||u.hash||/[^\x20-\x7e]|%|\\/.test(u.pathname)) fail('candidate URL rejected');
  const p=u.pathname.replace(/^\//,'').split('/'); if(p.length!==8||p[0]!=='kody-w'||p[1]!=='openrappter'||p[3]!=='candidates'||!/^[0-9a-f]{40}$/.test(p[2])||!/^[0-9a-f]{40}$/.test(p[4])||!['snapshot','release'].includes(p[5])||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(p[6])||p[6]==='.'||p[6]==='..'||!/^[0-9a-f]{64}\.tar\.gz$/.test(p[7])) fail('candidate URL rejected'); return {source:p[4],sha:p[7].slice(0,64)};
};
const closed = (value, keys, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(keys)) fail(`${label} is not closed`);
};

export function validateManifest(value, expectedRing, now = new Date()) {
  closed(value, top, 'manifest');
  if (value.schema !== 'openrappter-ring/v1') fail('wrong schema');
  if (!rings.includes(value.ring) || value.ring !== expectedRing) fail('wrong ring');
  closed(value.source, sourceKeys, 'source');
  if (value.source.repository !== 'kody-w/openrappter') fail('unauthorized source repository');
  if (!/^[0-9a-f]{40}$/.test(value.source.commit)) fail('commit must be 40 lowercase hex');
  if (value.source.tag !== null && !/^v[0-9][0-9A-Za-z.+-]*$/.test(value.source.tag)) fail('bad tag');
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(value.version)) fail('bad version');
  closed(value.artifact, artifactKeys, 'artifact');
  for (const field of ['url', 'install_url']) {
    if (field === 'install_url' && value.artifact[field] === null) continue;
    const url = new URL(value.artifact[field]);
    if (url.protocol !== 'https:' || !hosts.has(url.hostname)) fail(`unauthorized ${field}`);
  }
  if (!/^[0-9a-f]{64}$/.test(value.artifact.sha256)) fail('bad sha256');
  if (!['github-commit-archive-sha256', 'npm-registry-download-sha256', 'github-release-download-sha256', 'github-candidate-bundle-sha256'].includes(value.artifact.provenance)) fail('bad provenance');
  if (!['published', 'unpublished', 'disabled'].includes(value.status)) fail('bad status');
  if (value.status === 'published') {
    if (value.reason !== null || value.artifact.install_url === null) fail('published manifest is incomplete');
  } else if (typeof value.reason !== 'string' || !value.reason.trim()) fail('non-published manifest needs reason');
  const expectedPredecessor = value.ring === 'nightly' ? null : rings[rings.indexOf(value.ring) - 1];
  if (value.predecessor !== expectedPredecessor) fail('wrong predecessor');
  const promoted = new Date(value.promoted_at);
  if (Number.isNaN(promoted.valueOf()) || promoted > new Date(now.valueOf() + 300000)) fail('bad or future promoted_at');
  if (value.receipt !== null && !/^https:\/\/github\.com\/kody-w\/openrappter-release-train\/blob\/[0-9a-f]{40}\/receipts\/.+\.json$/.test(value.receipt)) fail('receipt is not immutable');
  if (value.promotion_id !== null && !/^[0-9a-f]{64}$/.test(value.promotion_id)) fail('bad promotion id');
  if (value.intended_release_tag !== null && !/^v[0-9][0-9A-Za-z.+-]*$/.test(value.intended_release_tag)) fail('bad intended release tag');
  const npmUrl = `https://registry.npmjs.org/openrappter/-/openrappter-${value.version}.tgz`;
  const releasePrefix = value.source.tag ? `https://github.com/kody-w/openrappter/releases/download/${value.source.tag}/` : '';
  if (value.status === 'published') {
    const npm = value.artifact.provenance === 'npm-registry-download-sha256' && value.artifact.url === npmUrl && value.artifact.install_url === npmUrl;
    const release = value.artifact.provenance === 'github-release-download-sha256' && releasePrefix && value.artifact.url.startsWith(releasePrefix) && value.artifact.install_url === value.artifact.url;
    let candidateOk=false; if(value.artifact.provenance==='github-candidate-bundle-sha256'&&value.artifact.install_url===value.artifact.url){try{const c=parseCandidateBundleUrl(value.artifact.url);candidateOk=c.source===value.source.commit&&c.sha===value.artifact.sha256;}catch{}}
    if (!npm && !release && !candidateOk) fail('published artifact is not bound to canonical package/version');
  } else {
    const archive = value.artifact.url === `https://github.com/kody-w/openrappter/archive/${value.source.commit}.tar.gz`;
    let candidateOk=false; if(value.artifact.provenance==='github-candidate-bundle-sha256'){try{const c=parseCandidateBundleUrl(value.artifact.url);candidateOk=c.source===value.source.commit&&c.sha===value.artifact.sha256;}catch{}}
    if ((!archive && !candidateOk) || value.artifact.install_url !== null) fail('nonpublished artifact is not exact canonical source');
  }
  return value;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const value = JSON.parse(readFileSync(process.argv[2], 'utf8'));
    validateManifest(value, process.argv[3]);
    console.log(`valid ${value.ring} manifest at ${value.source.commit}`);
  } catch (error) {
    console.error(`validate-manifest: ${error.message}`);
    process.exit(1);
  }
}
