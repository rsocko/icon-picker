# syntax=docker/dockerfile:1.7

FROM node:22.22.0-alpine3.23@sha256:e4bf2a82ad0a4037d28035ae71529873c069b13eb0455466ae0bc13363826e34 AS build

WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --global npm@11.19.0 && npm ci

COPY demo ./demo
COPY src ./src
COPY tsconfig.json vite.standalone.config.ts ./
RUN npx --no-install vite build --config vite.standalone.config.ts

FROM nginxinc/nginx-unprivileged:1.29.5-alpine3.23-slim@sha256:08c2bc93448bc00d2a2e86cd2f8f729220f1d48b56bbf7f211e117fcfe0c4cb6

ARG BUILD_VERSION=dev
ARG BUILD_REVISION=unknown
ARG BUILD_SOURCE=https://github.com/rsocko/icon-picker

LABEL org.opencontainers.image.title="Icon Picker" \
      org.opencontainers.image.description="Standalone full-page explorer for @rsocko/icon-picker" \
      org.opencontainers.image.url="https://icons.socko.us/" \
      org.opencontainers.image.source="${BUILD_SOURCE}" \
      org.opencontainers.image.version="${BUILD_VERSION}" \
      org.opencontainers.image.revision="${BUILD_REVISION}" \
      org.opencontainers.image.licenses="MIT"

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.conf /etc/nginx/conf.d/security-headers.inc
COPY --from=build /app/standalone-dist/ /usr/share/nginx/html/

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
