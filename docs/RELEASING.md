# Releasing `@rsocko/icon-picker`

## Why this exists

The primary corporate development environment cannot reach `registry.npmjs.org`
directly — it can only resolve packages through the approved proxy
(`https://packagefeedproxy.microsoft.io/npm/`), and policy forbids switching
registries or using unapproved tarballs to work around that. See
`rsocko/mission-control#1200` for the blocked-consumer side of this constraint.

npm Trusted Publishing (OIDC from GitHub Actions, no long-lived token) is the
target steady state: every release after the first is published from a GitHub
Actions runner with zero npm secrets. But npmjs requires a package to already
exist before Trusted Publishing can be linked to it, so the very first publish
is a one-time manual bootstrap from a network that *can* reach npmjs.

## One-time bootstrap (do this once, ever)

Perform this from a machine/network with real npmjs access — **not** the
corporate workstation (e.g. a personal machine or the maintainer's Docker
host). This repo's own CI/CD cannot do this step because GitHub-hosted
runners have no npmjs identity yet to attach Trusted Publishing to.

1. `npm login` (or use a short-lived automation token with the narrowest
   scope available — publish-only, single package if the registry supports it).
2. From a clean checkout of the exact release commit on `main`:
   ```
   npm ci
   npm run check          # lint, typecheck, test, build, demo build/verify, package:verify
   npm publish --access public --tag next
   ```
   The first version is `0.1.0-rc.0` under the `next` dist-tag.
3. Confirm the package and version are visible at
   `https://www.npmjs.com/package/@rsocko/icon-picker`.
4. Revoke/delete any temporary token immediately. Never commit a token or
   paste one into a PR/issue/log.
5. On npmjs.org, open the package → **Settings → Trusted Publisher** and add:
   - Provider: GitHub Actions
   - Owner: `rsocko`
   - Repository: `icon-picker`
   - Workflow file: `.github/workflows/release.yml`
   - Environment: `npm`

After this, npm publish credentials for this package should not be needed
again — `.github/workflows/release.yml` publishes via OIDC (`id-token: write`)
whenever a GitHub Release is published.

## GitHub environment protection (already configured)

The `npm` environment is restricted to deployments triggered from tags
matching `v*` (custom deployment branch/tag policy), matching how releases
are cut (tag `vX.Y.Z` → GitHub Release → `release.yml`). Consider also adding
required reviewers on the `npm` environment if you want a manual approval gate
before every publish.

## Ongoing release flow

1. Land changes on `main` via reviewed PRs (CI on `ci.yml` must pass).
2. Bump `version` in `package.json` on `main` (prerelease like `0.1.0-rc.1`
   for iteration, or a stable version like `0.1.0` / `1.0.0` once the API is
   settled).
3. Tag that commit `vX.Y.Z` and publish a GitHub Release from it.
4. `release.yml` verifies the tag commit is an ancestor of `main`, verifies the
   tag matches `package.json`'s version, then runs
   `npm publish --provenance --tag <next|latest>` with no stored token —
   `next` for any version containing `-`, `latest` otherwise.
5. Record in the release notes: package version, source commit SHA, the
   npm-reported integrity/shasum, and the npmjs release URL. This is what lets
   a downstream repo pin and verify the exact artifact (see "Downstream sync"
   below).

## Recovery

- **Publish step fails after the GitHub Release exists:** fix the underlying
  issue, delete the bad tag/release, re-tag, and re-publish the release. Do
  not attempt to force-publish the same version to npm — npm versions are
  immutable; cut a new patch/prerelease instead.
- **Trusted Publishing misconfigured:** publishing will fail with an OIDC/
  authorization error in the Actions log; nothing is exposed. Fix the
  configuration in npmjs.org's Trusted Publisher settings and re-run the
  release workflow.
- **Need to unpublish:** follow npm's unpublish policy (allowed only within a
  short window / for versions with no dependents); prefer `npm deprecate`
  for anything already installed by consumers.

## Downstream sync (Mission Control and other consumers)

Consumers on the corporate network cannot rely on `npm install
@rsocko/icon-picker` resolving through the approved proxy the moment a
version is published — the proxy mirrors npmjs on its own schedule, and
policy does not allow falling back to a different registry when it hasn't
caught up yet. Treat proxy availability as informational, not a release
gate.

Downstream repos (e.g. Mission Control, tracked in
`rsocko/mission-control#1476`) should pin an *exact* published version and
verify it against the release metadata above (commit SHA + integrity hash)
before adopting it, whether that's a normal registry install once mirrored or
a verified vendored snapshot in the interim. This is the same
provenance-manifest pattern under discussion for
`@rsocko/generic-graph-workbench` in `rsocko/mission-control#1200`/`#1329` —
keep both packages' bootstrap, Trusted Publishing, and downstream-verification
approach consistent so there's one release/consumption pattern for
externally-published, corporate-network-restricted libraries, not two.
