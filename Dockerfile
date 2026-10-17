# syntax=docker/dockerfile:1.7
#
# ГАДЮКА — production image: Next.js 16 standalone + Prisma 7 migrations on start.
# Build through docker compose (see DEPLOY.md):
#   - `next build` prerenders / and /en from the database, so the build needs a
#     migrated DB: compose builds with `network: host` and DATABASE_URL=…@127.0.0.1:5432;
#   - .env is passed as a BuildKit secret (never stored in an image layer).
#
# Targets: tools (migrate / seed one-off tasks) · runner (the app).

ARG NODE_IMAGE=node:24-alpine

# ── base ──────────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS base
# openssl: Prisma engine platform detection; libc6-compat: glibc shims for native deps.
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ── deps: all dependencies (dev included: prisma CLI, tsx) + generated Prisma client ──
FROM base AS deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma/schema.prisma ./prisma/schema.prisma
# postinstall runs `prisma generate` → src/generated/prisma (sharp installs its linuxmusl build).
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# ── tools: full source, for `docker compose run --rm tools <cmd>` (migrate, seed) ──
FROM deps AS tools
COPY . .
CMD ["npx", "prisma", "migrate", "deploy"]

# ── builder: next build (output: "standalone") ────────────────────────────────
FROM tools AS builder
ENV NODE_ENV=production
# The secret is mounted as .env.production.local on purpose: Next copies `.env` and
# `.env.production` into .next/standalone, which would bake secrets into the image.
RUN --mount=type=secret,id=dotenv,target=/app/.env.production.local,required=true \
    --mount=type=cache,target=/app/.next/cache \
    npm run build \
 && rm -f .next/standalone/.env .next/standalone/.env.* \
 && test -f .next/standalone/server.js

# ── migrator: a self-contained Prisma CLI for `prisma migrate deploy` at start ──
FROM base AS migrator
WORKDIR /migrate
COPY package-lock.json /tmp/package-lock.json
# Same prisma / dotenv versions as the app (read from the lockfile).
RUN --mount=type=cache,target=/root/.npm \
    PRISMA_VERSION="$(node -p "require('/tmp/package-lock.json').packages['node_modules/prisma'].version")" \
 && DOTENV_VERSION="$(node -p "require('/tmp/package-lock.json').packages['node_modules/dotenv'].version")" \
 && npm init -y >/dev/null \
 && npm install --no-audit --no-fund --omit=dev --save-exact "prisma@${PRISMA_VERSION}" "dotenv@${DOTENV_VERSION}" \
 && rm /tmp/package-lock.json
COPY prisma.config.ts ./
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma/migrations ./prisma/migrations

# ── runner: the production image ──────────────────────────────────────────────
FROM base AS runner
RUN apk add --no-cache su-exec
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UPLOAD_DIR=/app/uploads

COPY --from=migrator /migrate /migrate
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
RUN mkdir -p /app/uploads && chown node:node /app/uploads

COPY --chmod=755 <<'EOF' /usr/local/bin/gadyuka-entrypoint.sh
#!/bin/sh
# 1) hand the uploads volume to the app user (files created by `compose run tools` are root-owned)
# 2) prisma migrate deploy (skip with SKIP_MIGRATIONS=1), retried while the DB starts.
#    docker-compose.yml sets SKIP_MIGRATIONS=1: the app connects as a DML-only role, so
#    migrations run in the `tools` service as the superuser (DEPLOY.md, sections 8 and 9).
# 3) start the server as the unprivileged `node` user
set -eu
UPLOAD_DIR="${UPLOAD_DIR:-/app/uploads}"

# The admin fails closed in production without ADMIN_PASSWORD (src/lib/admin/admin-gate.ts).
if [ -z "${ADMIN_PASSWORD:-}" ] && [ "${ADMIN_ALLOW_OPEN:-0}" != "1" ]; then
  echo "[entrypoint] WARNING: ADMIN_PASSWORD is empty — /admin is LOCKED until it is set in .env (DEPLOY.md, section 7)" >&2
fi

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$UPLOAD_DIR"
  find "$UPLOAD_DIR" ! -user node -exec chown node:node {} + 2>/dev/null || chown -R node:node "$UPLOAD_DIR"
fi

if [ "${SKIP_MIGRATIONS:-0}" != "1" ]; then
  attempt=1
  until (cd /migrate && ./node_modules/.bin/prisma migrate deploy); do
    if [ "$attempt" -ge 5 ]; then
      echo "[entrypoint] prisma migrate deploy failed after $attempt attempts" >&2
      exit 1
    fi
    attempt=$((attempt + 1))
    echo "[entrypoint] retrying migrations in 3s…" >&2
    sleep 3
  done
fi

if [ "$(id -u)" = "0" ]; then
  exec su-exec node "$@"
fi
exec "$@"
EOF

EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/gadyuka-entrypoint.sh"]
CMD ["node", "server.js"]
