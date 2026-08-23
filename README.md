# OpenRappter nightly ring

Nightly follows **vetted canonical `main` snapshots**. It records an exact
40-hex source commit and measured archive SHA-256; it never treats `main` as a
release identity. This repository is a pointer, not a code copy.

The current [manifest](.ring/manifest.json) truthfully says `unpublished`: the
snapshot exists, but an installable nightly artifact does not. `--ring nightly`
therefore fails closed.

Train: `nightly -> alpha -> canary -> beta -> stable`.

Validate with `node scripts/validate-manifest.mjs .ring/manifest.json nightly`.

Distribution invariant: this finalized receipt is step 1 of the machine-required
nightly → alpha → canary → beta chain. No stable/tag/npm/PyPI/GitHub release or
installer channel may bypass it. Tests in `openrappter-release-train`, not this
prose, are authoritative.

`.ring/manifest.json` and `.ring/authority.json` on this repository's `main`
are informational. Clients resolve latest only from the monotonic
`openrappter-release-train/heads/nightly.json` authority head.

Applications are immutable per sequence at
`.ring/applied/<20-digit-sequence>-<request-id>.json`; snapshots and tagged
release candidates use separate candidate namespaces for the same source.
