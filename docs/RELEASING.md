# Releasing and vendoring `@rsocko/icon-picker`

Public npm is an optional distribution channel. A downstream consumer can
build and verify a deterministic package from an exact source commit or tag
without waiting for npmjs or an npm mirror.

## Exact-commit artifact

Use a clean checkout whose dependencies were restored through the repository's
approved registry:

```sh
git checkout <40-character-commit-or-vX.Y.Z-tag>
npm ci
npm run check
npm run package:artifact
```

`package:artifact` builds the package, copies only publishable files into a
canonical staging tree, normalizes every staged text file to LF, runs
`npm pack` twice, and fails if the two tarballs differ or do not match the
committed [`package-artifact.json`](../package-artifact.json) contract. It
writes these ignored local artifacts:

- `artifacts/rsocko-icon-picker-<version>.tgz`
- `artifacts/UPSTREAM.json`

TypeScript declaration output is explicitly configured for LF newlines, and
`.gitattributes` keeps tracked text inputs on LF across operating systems.
CI executes the full package verification on both Ubuntu and Windows. Both
jobs must reproduce the size, integrity, checksums, and entry counts committed
in `package-artifact.json`; same-host repeatability alone is insufficient.
The repository and release workflows pin npm `11.19.0`, so artifact bytes do
not silently change with a runner image's bundled npm version.

`UPSTREAM.json` is deterministic and machine-readable. It records the package
identity, exact source commit and optional matching version tag, repository,
npm integrity and shasum, SHA-256 and SHA-512 hashes, sizes, entry count, and
the sorted package file manifest. It also records the canonicalization contract.
The command refuses a dirty checkout and a tag that does not match
`package.json`.

A vendored consumer should commit the unpacked, verified publishable package
plus its `UPSTREAM.json`, depend on that snapshot through a local `file:`
dependency, and update it only in a reviewed synchronization change. It should
verify the source commit, package identity, export map, file allowlist, and
artifact hashes before replacing its existing snapshot.

This follows the proven controlled-source pattern used by Mission Control's
Generic Graph integration: pin an immutable merged source commit, generate a
bounded payload, and verify provenance and file hashes locally. It does not
require a sibling checkout, network access during normal installation, or
GitHub Packages credentials.

## Optional npm bootstrap

The primary corporate development environment can restore dependencies only
through `https://packagefeedproxy.microsoft.io/npm/`. Do not change the
repository registry or add a fallback registry to work around mirror delay.

The first npmjs publication, if desired, must be performed once from a trusted
network that can authenticate to npmjs:

1. Check out the exact reviewed release commit on `main`.
2. Run `npm ci`, `npm run check`, and `npm run package:artifact`.
3. Publish `0.1.0-rc.0` (or its documented successor) with
   `npm publish --access public --tag next`.
4. Confirm public access, then revoke any temporary token immediately.
5. Configure npm Trusted Publishing for owner `rsocko`, repository
   `icon-picker`, workflow `release.yml`, and environment `npm`.

Never commit a token or paste one into issue, pull-request, or workflow logs.
After bootstrap, `.github/workflows/release.yml` publishes via OIDC and npm
provenance with no stored npm token.

## Ongoing tagged releases

1. Merge a reviewed version bump to `main`.
2. Tag that exact commit `vX.Y.Z` and publish a matching GitHub Release.
3. The release workflow verifies that the commit is on `main`, runs the full
   check, verifies the tag/version pair, and publishes prereleases under
   `next` or stable versions under `latest`.
4. Attach or record the generated `UPSTREAM.json` values in release notes.

Published npm versions are immutable. If publication fails after a release is
created, fix the cause and cut a new version rather than overwriting an
existing package version.

The release workflow's `npm publish` invokes `prepack`, which rebuilds before
publishing. The LF source/declaration rules ensure that publish output matches
the cross-platform artifact contract. Do not publish if either CI operating
system reports a contract mismatch.

## Mission Control synchronization

Mission Control tracks the verified local mirror in
`rsocko/mission-control#1476`. Its clean install, CI, Docker, and agent
workflows must not require npmjs, GitHub Packages, a sibling checkout, or
runtime synchronization. Proxy availability is informational, not a
prerequisite: Mission Control can consume the exact artifact generated above
from the pinned source commit and later compare it with a mirrored npm artifact
when that exact version becomes available.
