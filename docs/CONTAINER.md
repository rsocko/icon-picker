# Standalone container deployment

The production container serves the full-page explorer directly at `/`, without
the `/icon-picker/explorer/` GitHub Pages base path. It is a deterministic
multi-stage build with digest-pinned Node and unprivileged Nginx base images.
Nginx listens as a non-root user on port `8080`, exposes `GET /healthz`, applies
the explorer's provider-aware Content Security Policy, disables caching for the
HTML shell, and caches content-hashed assets immutably for one year. Unknown
client-side paths fall back to the explorer document.

Build and test it locally with:

```sh
docker build --tag icon-picker:local .
docker run --rm --name icon-picker --init --cap-drop ALL \
  --security-opt no-new-privileges:true --publish 18080:8080 icon-picker:local
node scripts/smoke-container.mjs
```

The `Build and publish container` workflow runs the complete project checks and
a live container smoke test before publishing the multi-platform
`linux/amd64` and `linux/arm64` image to:

```text
ghcr.io/rsocko/icon-picker
```

Pushes to `main` publish `edge` and `sha-<full-git-sha>`. A matching
`v<package-version>` tag additionally publishes the exact SemVer tag. Stable
releases also publish major/minor, major, and `latest` aliases.
Deployments should pin either the `sha-<full-git-sha>` tag or the digest emitted
in the workflow summary, for example:

```text
ghcr.io/rsocko/icon-picker:sha-0123456789abcdef0123456789abcdef01234567
ghcr.io/rsocko/icon-picker@sha256:<manifest-digest>
```

Publishing uses the workflow's short-lived `GITHUB_TOKEN` with only
`contents: read` and `packages: write`; no registry secret or npm publication is
required. GitHub Container Registry packages inherit private visibility by
default in some account configurations. After the first successful publish,
open the `icon-picker` container package, choose **Package settings → Change
visibility → Public**, and confirm the change once so homelab hosts can pull
anonymously.
