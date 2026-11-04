# syntax=docker/dockerfile:1.7
#
# ГАДЮКА backend (NestJS 12 + NodeAdapter + Prisma 7) — production images. Build context = the REPOSITORY ROOT
# (the backend compiles ../shared/contracts and reads ../shared/messages); the root .dockerignore applies.
#
#   docker compose build backend migrate      (root docker-compose.yml; see the root README.md)
#
# Targets:
#   runtime  the API server (also the seed: `node dist/backend/src/cli/seed.js`) — compiled dist +
#            production node_modules + shared/messages + backend/assets, non-root user `node`
#   migrate  one-off: `prisma migrate deploy` as the database owner, then the DML-only role of the
#            server (docker/app-db-role.mjs) — the build stage with the Prisma CLI
#
# Layout inside the images (the app finds shared/messages and assets by walking up from dist):
#   /app/backend/{dist,node_modules,assets,package.json}   /app/shared/messages

# Exact tags, so a rebuild never picks up another Node. Build stages: Node = backend/.nvmrc — its npm
# (11.6.2) wrote the lockfiles (the npm 11.19 of later Node 24 images rejects frontend/package-lock.json).
# Runtime: the newest patch release of the same LTS line (security fixes; N-API addons such as sharp
# are ABI-stable within a major). Bump them together with .nvmrc.
ARG NODE_BUILD_IMAGE=node:24.11.1-alpine3.23
ARG NODE_IMAGE=node:24.22.0-alpine3.23

# ── deps: every dependency (dev included: tsc, prisma CLI + its schema engine) ───────────────────────
FROM ${NODE_BUILD_IMAGE} AS deps
# openssl: the Prisma CLI detects the OpenSSL version to pick its schema-engine binary.
RUN apk add --no-cache openssl
WORKDIR /app/backend
# HUSKY=0: `npm ci` runs the package's prepare script (git hooks) — there is no repository here.
ENV HUSKY=0 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1
COPY backend/package.json backend/package-lock.json backend/.npmrc ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# ── build: prisma generate + tsc (tsconfig.prod.json: no tests, no source maps) ─────────────────────
FROM deps AS build
WORKDIR /app
COPY shared ./shared
COPY backend ./backend
WORKDIR /app/backend
RUN npm run build \
 && test -f dist/backend/src/main.js \
 && test -f dist/backend/src/cli/seed.js

# ── migrate: one-off schema migrations + the server's database role ────────────────────────────────
FROM build AS migrate
USER node
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node docker/app-db-role.mjs"]

# ── prod-deps: runtime dependencies only (sharp brings its musl build of libvips) ──────────────────
# The runtime's Node / npm: npm 11.19 resolves the trimmed tree cleanly (npm 11.6.2 keeps ~180 MB of
# the Prisma CLI's dependencies); the backend lockfile is accepted by both.
FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /app/backend
ENV HUSKY=0 \
    NPM_CONFIG_UPDATE_NOTIFIER=false
COPY backend/package.json backend/package-lock.json backend/.npmrc ./
# Not `npm ci --omit=dev`: it keeps the Prisma CLI, TypeScript and their trees (devDependencies that are
# also optional peers of @prisma/client: ~260 MB more). Without the devDependencies npm resolves the
# tree again — with every version taken from package-lock.json (verified: no version differs).
RUN --mount=type=cache,target=/root/.npm npm pkg delete devDependencies \
 && npm install --omit=dev --no-audit --no-fund \
 && test ! -e node_modules/prisma \
 && test ! -e node_modules/@prisma/engines

# ── runtime: the API server ────────────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS runtime
# NODE_ENV is the app's own enum (dev | test | uat | prod), validated at startup.
ENV NODE_ENV=prod \
    APP_HOST=0.0.0.0 \
    APP_PORT=4000 \
    LOG_DIR=/var/log/gadyuka
WORKDIR /app/backend
# Everything is owned by root and read-only for the `node` user, except the logs directory (a volume).
COPY --from=prod-deps /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
COPY backend/package.json ./package.json
COPY backend/assets ./assets
COPY shared/messages /app/shared/messages
RUN mkdir -p /var/log/gadyuka && chown node:node /var/log/gadyuka
USER node
EXPOSE 4000
CMD ["node", "dist/backend/src/main.js"]
