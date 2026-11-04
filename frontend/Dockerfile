# syntax=docker/dockerfile:1.7
#
# ГАДЮКА frontend (Next.js 16, output: standalone) — production image. Build context = the REPOSITORY
# ROOT (the app imports ../shared at build time); the root .dockerignore applies.
#
#   docker compose build frontend      (root docker-compose.yml; see the root readme_dev.md)
#
# `next build` needs neither the backend nor a database (public reads happen per request) and no
# secrets: nothing secret is passed to the build. Build arguments are public values that end up in
# prerendered pages: SITE_URL (canonical, sitemap, robots, Open Graph — rebuild after a change) and the
# search engine verification codes (meta tags).
#
# At start the container copies the build's static files (.next/static with their precompressed
# .br/.zst/.gz siblings, public/) into STATIC_PUBLISH_DIR — a volume the reverse proxy serves
# /_next/static/* and /brand/* from (docker/publish-static.mjs, frontend/docs/COMPRESSION.md).

# Exact tags, so a rebuild never picks up another Node. Build stages: Node = backend/.nvmrc — its npm
# (11.6.2) wrote the lockfiles (the npm 11.19 of later Node 24 images rejects frontend/package-lock.json).
# Runtime: the newest patch release of the same LTS line (security fixes; N-API addons such as sharp
# are ABI-stable within a major). Bump them together with .nvmrc.
ARG NODE_BUILD_IMAGE=node:24.11.1-alpine3.23
ARG NODE_IMAGE=node:24.22.0-alpine3.23

# ── deps: every dependency (dev included: TypeScript, Tailwind for `next build`) ────────────────────
FROM ${NODE_BUILD_IMAGE} AS deps
WORKDIR /app/frontend
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# ── build: next build + postbuild (strip .env copies, precompress static files) ─────────────────────
FROM ${NODE_BUILD_IMAGE} AS build
ARG SITE_URL
ARG GOOGLE_SITE_VERIFICATION=""
ARG YANDEX_VERIFICATION=""
ENV NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NODE_ENV=production
WORKDIR /app
COPY shared ./shared
COPY frontend ./frontend
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules
WORKDIR /app/frontend
# BACKEND_URL points at a closed port: nothing may reach a backend during the build (and none exists).
RUN test -n "${SITE_URL}" || { echo 'build argument SITE_URL is required (https://<domain>)' >&2; exit 1; }; \
    SITE_URL="${SITE_URL}" \
    GOOGLE_SITE_VERIFICATION="${GOOGLE_SITE_VERIFICATION}" \
    YANDEX_VERIFICATION="${YANDEX_VERIFICATION}" \
    BACKEND_URL=http://127.0.0.1:1 \
    npm run build \
 && test -f .next/standalone/frontend/server.js \
 && test -f .next/BUILD_ID

# ── runtime: the standalone server ──────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS runtime
# HOSTNAME=0.0.0.0, never 127.0.0.1: next-intl's locale proxy would loop redirecting "local" requests.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    STATIC_PUBLISH_DIR=/srv/static
WORKDIR /app
# The standalone output mirrors the repository (tracing root = repo root): /app/frontend/server.js.
# Code and dependencies stay root-owned (read-only for `node`); .next is the server's own (cache, ISR).
COPY --from=build /app/frontend/.next/standalone ./
COPY --from=build --chown=node:node /app/frontend/.next/static ./frontend/.next/static
COPY --from=build /app/frontend/public ./frontend/public
COPY --chmod=755 frontend/docker/entrypoint.sh /usr/local/bin/gadyuka-frontend
COPY frontend/docker/publish-static.mjs /usr/local/lib/gadyuka/publish-static.mjs
RUN chown -R node:node /app/frontend/.next \
 && mkdir -p /app/frontend/.next/cache /srv/static \
 && chown node:node /app/frontend/.next/cache /srv/static
USER node
WORKDIR /app/frontend
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/gadyuka-frontend"]
CMD ["node", "server.js"]
