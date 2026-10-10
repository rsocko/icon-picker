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

## npm bootstrap

The primary corporate development environment can restore dependencies only
through `https://packagefeedproxy.microsoft.io/npm/`. Do not change the
repository registry or add a fallback registry to work around mirror delay.

The initial `0.1.0-rc.0` publication was performed manually from a trusted
network. npm Trusted Publishing is configured for owner `rsocko`, repository
`icon-picker`, workflow `release.yml`, and environment `npm`.

Never commit a token or paste one into issue, pull-request, or workflow logs.
`.github/workflows/release.yml` publishes ongoing releases via OIDC and npm
provenance with no stored npm token. The `0.1.0-rc.2` release proved the
end-to-end trusted-release flow.

## Ongoing tagged releases

1. Merge a reviewed version bump to `main`.
2. Tag the canonical merged `main` commit `vX.Y.Z` and push the tag.
3. Publish a matching GitHub Release. Publishing the GitHub Release triggers
   [`.github/workflows/release.yml`](../.github/workflows/release.yml); pushing
   the tag alone does **not** publish to npm.
4. The release workflow verifies that the commit is on `main`, runs the full
   check, verifies the tag/version pair, and publishes prereleases under
   `next` or stable versions under `latest`.
5. Attach or record the generated `UPSTREAM.json` values in release notes.

From a clean checkout, fetch canonical `main`, inspect its full
40-character SHA, and confirm that it is the reviewed version-bump commit:

```sh
git fetch origin main --tags
SHA="$(git rev-parse "origin/main^{commit}")"
VERSION="$(git show "$SHA:package.json" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).version))")"
TAG="v$VERSION"

printf 'Release %s from %s\n' "$TAG" "$SHA"
git merge-base --is-ancestor "$SHA" origin/main
test "$(git rev-parse "origin/main^{commit}")" = "$SHA"
git tag "$TAG" "$SHA"
test "$(git rev-parse "$TAG^{commit}")" = "$SHA"
git push origin "refs/tags/$TAG"
```

The exact-SHA equality check makes this the release of current canonical
`main`, rather than an older commit that merely appears somewhere in its
history. If `main` advances before tagging, review the new tip and update
`SHA`; do not release an unreviewed commit.

Create the matching prerelease after the tag push:

```sh
gh release create "$TAG" \
  --repo rsocko/icon-picker \
  --target "$SHA" \
  --title "$TAG" \
  --generate-notes \
  --prerelease
```

For a stable `X.Y.Z` version, use the same command without `--prerelease`.
Do not create a prerelease GitHub Release without the flag: prerelease package
versions are published under npm's `next` distribution tag, but the GitHub
Release must also be marked as a prerelease for consumers.

Confirm that the release event ran the trusted-publishing workflow for the
tag and that it succeeded:

```sh
RUN_ID="$(gh run list \
  --repo rsocko/icon-picker \
  --workflow release.yml \
  --event release \
  --limit 20 \
  --json databaseId,headBranch \
  --jq ".[] | select(.headBranch == \"$TAG\") | .databaseId" |
  head -n 1)"
test -n "$RUN_ID"
gh run watch "$RUN_ID" --repo rsocko/icon-picker --exit-status
gh run view "$RUN_ID" --repo rsocko/icon-picker
```

Finally, check the public package metadata and the **Provenance** entry on the
matching npm version page:

```sh
npm view "@rsocko/icon-picker@$VERSION" \
  version dist-tags dist.integrity \
  --registry=https://registry.npmjs.org/
printf 'https://www.npmjs.com/package/@rsocko/icon-picker/v/%s\n' "$VERSION"
```

The successful workflow must show `Publish with npm trusted publishing`, and
the npm version page must show provenance linked to this repository and
release workflow. Treat a missing or mismatched provenance entry as a failed
release even if package metadata is visible.

Published npm versions are immutable. If publication fails after a release is
created, fix the cause and cut a new version rather than overwriting an
existing package version.

The release workflow's `npm publish` invokes `prepack`, which rebuilds before
publishing. The LF source/declaration rules ensure that publish output matches
the cross-platform artifact contract. Do not publish if either CI operating
system reports a contract mismatch.

## Mission Control synchronization

Mission Control's
[icon picker integration runbook](https://github.com/rsocko/mission-control/blob/main/docs/architecture/icon-picker-integration.md)
is the source of truth for downstream updates. Its **Sync icon picker vendor**
workflow checks upstream daily at 09:17 UTC and can also be run on demand for
the latest upstream `main` commit or a specified full commit SHA already merged
to `main`. A changed snapshot creates or updates one review pull request; it
never auto-merges, publishes, tags, or releases.

Mission Control builds the deterministic package artifact from the pinned
exact source commit, verifies package identity, exports, file allowlists,
hashes, integrity, and provenance, and only then atomically replaces its
vendored snapshot. Its clean install, CI, Docker, and agent workflows use that
reviewed local snapshot and do not depend on npm availability, GitHub Packages
credentials, a sibling checkout, or runtime synchronization.
