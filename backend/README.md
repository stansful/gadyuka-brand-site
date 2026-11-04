# ГАДЮКА — backend

NestJS 12 (`@nestjs/platform-node`) API of the site: content, media, leads and the admin. Only the Next.js server
(`frontend/`) calls it — the backend is never exposed publicly; browsers reach it only through
`/media/*`, which the site rewrites here.

Coding rules: [docs/CLAUDE.md](docs/CLAUDE.md) (short) and [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)
(why and how). Reference project of the conventions: `docs/example-without-dot-env/` (read-only).

## Setup

1. Node from `.nvmrc`: `nvm use` (or install that version).
2. Dependencies: `npm ci` — also installs the git hooks for the whole repository (see [Git hooks](#git-hooks)).
3. Environment: `cp .env.example .env`, then fill in the empty secrets (`openssl rand -hex 32` each;
   `ADMIN_PASSWORD` at least 16 characters). Nothing reads `.env` but `node --env-file` / Docker Compose
   — there is no dotenv.
4. Services: `docker compose up -d` — PostgreSQL 18 on `127.0.0.1:5433`, MinIO on `127.0.0.1:9010`
   (console `127.0.0.1:9011`), plus a one-off `minio-init` that creates the bucket and the backend's own
   MinIO user. Data: `~/docker-volumes/gadyuka-dev/{postgres,minio}`. The ports differ from the old
   single-app containers (5432, 9000/9001), which may still exist on a dev machine — nothing uses them.
5. Database: `npm run prisma:deploy`, then `npm run db:seed` (the admin from `ADMIN_LOGIN` /
   `ADMIN_PASSWORD`, the site texts, the seed images and the demo content; safe to repeat — see [Seed](#seed)).
6. Run: `npm run start:dev` → `http://127.0.0.1:4000`, Swagger UI at `/api/v1/swagger` (dev only;
   authorize with the `x-internal-key` and, for `auth/me` and `admin/*`, a bearer token from `auth/login`).

```bash
curl -H "x-internal-key: $INTERNAL_API_KEY" http://127.0.0.1:4000/api/v1/public/health
```

## Scripts

| Script                                                       | What it does                                                                              |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `npm run start:dev`                                          | prisma generate + migrate deploy, type check, `nest start --watch` with `.env`            |
| `npm run start:prod` / `start:uat` / `start:test`            | generate + migrate deploy + compile, then `node dist/backend/src/main.js`                 |
| `npm run build`                                              | clean, prisma generate, compile without tests/maps (`tsconfig.prod.json`)                 |
| `npm run type:check`                                         | `tsc` + `tsc-alias` (path aliases → relative requires) into `dist/`                       |
| `npm test`                                                   | compile, migrate the test database, run every `*.test.js` with `node --test` (unit + e2e) |
| `npm run test:unit`                                          | compile, unit tests only (no database / MinIO needed)                                     |
| `npm run test:e2e`                                           | compile, migrate the test database, e2e tests only                                        |
| `npm run test:slice -- <area> [pattern …]`                   | isolated run of one area: own build, own database (see [Tests](#tests))                   |
| `npm run lint` / `lint:check`                                | oxlint + oxfmt with fixes / check only                                                    |
| `npm run gen:usecase`                                        | hygen: a new endpoint folder (see [Generator](#generator))                                |
| `npm run db:seed`                                            | compile, run `dist/backend/src/cli/seed.js` (idempotent)                                  |
| `npm run prisma:migration -- --name <name>`                  | new migration from the schema (create-only: add CHECKs, then deploy)                      |
| `npm run prisma:deploy` / `prisma:prepare` / `prisma:studio` | apply migrations / generate the client / Prisma Studio                                    |
| `npm run husky:prepare`                                      | (re)install the git hooks of the repository                                               |

The compiled app lives in `dist/backend/src/…`: `rootDir` is the repository root because the backend
compiles the shared contracts (`../shared/contracts`) too.

## Environment

All variables are validated at startup (`src/config/config-environment.validator.ts`): a missing or invalid
one stops the app with its name (never its value). See `.env.example` for comments.

| Variable                                                                                                   | Meaning                                                                     |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `NODE_ENV`                                                                                                 | `dev` \| `test` \| `uat` \| `prod` (Swagger and colored logs only in `dev`) |
| `APP_HOST`, `APP_PORT`                                                                                     | listen address (`127.0.0.1:4000` in dev)                                    |
| `LOG_DIR`                                                                                                  | optional: also append JSON log lines to `<LOG_DIR>/backend.log`             |
| `POSTGRES_NAME`, `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASS`                        | database; the URL is built from these parts (app and `prisma.config.ts`)    |
| `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_API_PORT`, `MINIO_CONSOLE_PORT`                           | dev MinIO container only (not read by the app)                              |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE` | media storage (`@nestjs/storage` S3Disk; MinIO needs path style)            |
| `INTERNAL_API_KEY`                                                                                         | shared secret of the Next.js server (`x-internal-key`), ≥ 32 characters     |
| `AUTH_ACCESS_SECRET`, `AUTH_ACCESS_TTL`, `AUTH_REFRESH_TTL`                                                | HS256 secret (≥ 32), access / refresh lifetimes in seconds (900 / 2592000)  |
| `ADMIN_LOGIN`, `ADMIN_PASSWORD`                                                                            | the admin account the seed creates / updates (not needed by the server)     |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_OWNER_ID`, `TELEGRAM_DRY_RUN`                                              | lead notifications; dry run = no network, the lead counts as not sent       |
| `IP_HASH_SALT`                                                                                             | salt of visitor IP hashes (lead rate limits), ≥ 16 characters               |
| `SITE_URL`                                                                                                 | public site origin (links in Telegram messages)                             |
| `SEED_OVERWRITE`                                                                                           | `npm run db:seed` only: `1` resets every seeded row ([Seed](#seed))         |

`.env.test` (committed, no secrets) overrides `.env` for `npm test`: `NODE_ENV=test` and the separate
database `gadyuka_test` (created by `prisma migrate deploy` on first use).

## API

- Every route lives under `/api/v1` and needs `x-internal-key: <INTERNAL_API_KEY>`, except
  `GET|HEAD /media/*`. The visitor's IP comes in `x-client-ip` (rate limits), their User-Agent in
  `x-client-user-agent` (lead metadata, sessions; the request's own `user-agent` is the site server's HTTP
  client and is never read).
- Time budgets: every route answers within the site server's request timeout (`shared/contracts/http.ts`
  `ApiRequestTimeoutMs`, 10 s) — e.g. the lead transaction waits at most 2 s for a connection and runs at
  most 5 s; `POST /admin/leads/:id/resend` waits for Telegram and has its own `LeadResendTimeoutMs` (50 s),
  the «Тексты сайта» save / reset (a 5 s + 30 s locked transaction) `SiteTextsWriteTimeoutMs` (45 s).
- Groups (`src/usecases`): **public** (`@Public()`), **auth**, **admin** (`@Roles([UserRole.ADMIN])`).
- Errors: `{ statusCode, error, key, values?, details? }`; validation: `400 { error: 'validation', fields: { <path>: { key, values? } } }`.
  `key` is a message key of `shared/messages` — the frontend translates. Types: `shared/contracts`.

| Route                                                       | Access                  |                                                                                                   |
| ----------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------- |
| `GET /api/v1/public/health`                                 | public                  | 200 `{ status, database, storage, uptimeSeconds, timestamp }`, 503 when a dependency is down      |
| `GET /api/v1/public/messages/:locale`                       | public                  | the site UI messages of a locale: admin edits (Message rows) over `shared/messages`               |
| `GET /api/v1/public/landing/:locale`                        | public                  | everything the landing renders, localized (texts, images, menu, socials, catalog, reviews …)      |
| `GET /api/v1/public/collections/:slug?locale=`              | public                  | a published collection page; 404 missing / hidden, 400 malformed slug or locale                   |
| `GET /api/v1/public/collections`                            | public                  | the published collection slugs (≤ 200)                                                            |
| `GET /api/v1/public/sitemap`                                | public                  | lastmod of the landing and of every collection page                                               |
| `GET /api/v1/public/settings/:locale`                       | public                  | contacts, SEO texts, star scale, OG image (defaults before the first save)                        |
| `POST /api/v1/public/leads`                                 | public, rate-limited    | a lead of the site form → 201 `{ id }`; 400 `forms.errors.*` fields, 429 (5 / 10 min per network) |
| `POST /api/v1/auth/login`                                   | public, throttled       | `{ login, password }` → tokens; 5 attempts / min per visitor IP + login, then 429 for 5 min       |
| `POST /api/v1/auth/refresh`                                 | public                  | `{ refreshToken }` → new tokens (rotation)                                                        |
| `POST /api/v1/auth/logout`                                  | public                  | `{ refreshToken }` → 204 (idempotent)                                                             |
| `GET /api/v1/auth/me`                                       | signed in               | the user and the session                                                                          |
| `GET /api/v1/admin/dashboard`                               | ADMIN                   | counts of every list, media, text and lead counters, the 5 latest leads                           |
| `GET /api/v1/admin/dashboard/new-leads`                     | ADMIN                   | `{ count }` of new leads (the sidebar badge)                                                      |
| `GET\|PUT /api/v1/admin/site-texts`                         | ADMIN                   | «Тексты сайта»: a section or a search (`?section=&q=`); save with conflict check (409)            |
| `POST /api/v1/admin/site-texts/reset`                       | ADMIN                   | `{ key }` → the defaults stored again                                                             |
| `GET\|POST /api/v1/admin/{collections,products,reviews}`    | ADMIN                   | list / create (created last in its list)                                                          |
| `GET\|PUT /api/v1/admin/{collections,products,reviews}/:id` | ADMIN                   | edit form / update; 400 `admin.errors.invalidId` for a malformed id                               |
| `GET /api/v1/admin/reviews/rating-scale`                    | ADMIN                   | `{ max }` — the current star scale                                                                |
| `GET\|PUT /api/v1/admin/settings`                           | ADMIN                   | the site settings (lowering the star scale below a stored rating → 409)                           |
| `GET\|POST /api/v1/admin/{news,gallery,offers,partners}`    | ADMIN                   | list / create                                                                                     |
| `GET\|POST /api/v1/admin/{menu-items,social-links}`         | ADMIN                   | list / create                                                                                     |
| `GET\|PUT /api/v1/admin/<content entity>/:id`               | ADMIN                   | edit form / update of a news item, gallery item, offer, partner, menu item, social link           |
| `POST /api/v1/admin/gallery/bulk`                           | ADMIN                   | `{ mediaIds, published }` → `{ count }` (several pictures at once)                                |
| `GET /api/v1/admin/menu-items/link-targets`                 | ADMIN                   | the collection pages a menu item may link to                                                      |
| `GET /api/v1/admin/social-links/default-labels`             | ADMIN                   | the default label of every social type (site texts `social.*`)                                    |
| `PATCH /api/v1/admin/entities/:kind/:id/published`          | ADMIN                   | `{ published }` → `{ id, published }` (publish toggle of an admin list row)                       |
| `POST /api/v1/admin/entities/:kind/reorder`                 | ADMIN                   | `{ ids }` → 204 (`ids[i]` gets order i; products only within one collection)                      |
| `DELETE /api/v1/admin/entities/:kind/:id`                   | ADMIN                   | 204 (media files stay; a collection goes with its products)                                       |
| `GET\|POST /api/v1/admin/media`                             | ADMIN                   | the library (`?cursor=&q=`, 60 per page) / upload (multipart `file`, ≤ 50 MB → WebP)              |
| `GET\|DELETE /api/v1/admin/media/:id`                       | ADMIN                   | details with every place that uses the file / delete (409 `inUse` while it is used)               |
| `PATCH /api/v1/admin/media/:id/alt`                         | ADMIN                   | `{ alt }` → the alt texts (trimmed, ≤ 300 per language)                                           |
| `GET /api/v1/admin/leads`                                   | ADMIN                   | `?type&status&page` — 25 per page, newest first                                                   |
| `GET /api/v1/admin/leads/:id`                               | ADMIN                   | a lead with its message, Telegram outcome and meta                                                |
| `PATCH /api/v1/admin/leads/:id/status`                      | ADMIN                   | `{ status }` → `{ id, status }`                                                                   |
| `POST /api/v1/admin/leads/:id/resend`                       | ADMIN                   | send the Telegram notification again → `{ id, telegramSent, telegramError }`                      |
| `GET /api/v1/admin/leads/telegram/status`                   | ADMIN                   | `{ dryRun }` (TELEGRAM_DRY_RUN: the admin shows a warning)                                        |
| `GET\|HEAD /media/<key>`                                    | anyone, no internal key | the stored file: ETag / 304, Range, immutable cache, nosniff, sandbox CSP                         |

Request and response types of every route: `shared/contracts/<area>.ts`; the dev Swagger UI
(`/api/v1/swagger`) describes all of them (`src/swagger/swagger.setup.e2e.test.ts` keeps it complete).

`:kind` of the list operations: `collection`, `product`, `review`, `news` (publish / delete only),
`gallery`, `offer`, `partner`, `menuItem`, `socialLink` (`shared/contracts/entities.ts`). Known
database errors need no `catch` in a usecase: the filter answers a unique violation with 409
`admin.errors.duplicate`, a foreign key violation with 409 `admin.errors.related`, a missing row of
an update / delete with 404 `admin.errors.notFound` (`src/exception/renderers/prisma-error.renderer.ts`).

### Site messages (`src/module/site-messages`)

`SiteMessagesService` resolves the site UI messages per locale: Message rows over the
`shared/messages` defaults (a blank ru row → `""`, a blank row of another locale → the ru value,
orphan rows ignored), cached in the process (5 min expiry as a safety net for the seed / manual SQL).
`findValues(locale)` (flat), `findTree(locale)` (nested), `snapshotOf(locale)` (last read, sync) and
`invalidate()` — **call it after every write of Message rows** (the admin site texts). The Telegram
texts (`TelegramTexts`) read it: `TelegramLeadNotifier.notify` loads the current `telegram.*` texts
first; another flow that needs a status text calls `await telegramTexts.load()` before `text()`.

### Admin sessions (own wrapper over `@nestjs/jwt`, no passport)

- **Access token**: HS256 JWT signed with `AUTH_ACCESS_SECRET`, lifetime `AUTH_ACCESS_TTL` (15 min),
  issuer `gadyuka-backend`, audience `gadyuka-admin`, claims `{ sub: user id, role, sid: session id }`.
  `AuthGuard` (global) checks the signature and expiry **and** that the session is not revoked — logout
  and reuse detection end access immediately, not after 15 minutes.
- **Refresh token**: `<refresh token id>.<32 random bytes base64url>`, lifetime `AUTH_REFRESH_TTL`
  (30 days, renewed by every refresh). Only `sha256(secret)` is stored (`refresh_tokens.token_hash`).
  Every refresh exchanges the token for a new one (atomic: `UPDATE … WHERE revoked_at IS NULL`); an
  exchanged token presented again revokes the whole session (`sessions.revoke_reason = TOKEN_REUSE`) —
  clients must refresh once and use the new pair.
- **Tables**: `users` (`login` unique lowercase, `password_hash` scrypt `salt:key`, `role`, `name`),
  `sessions` (one sign-in: user, user agent, `last_used_at`, `revoked_at` + `revoke_reason`),
  `refresh_tokens` (session, `token_hash`, `expires_at`, `revoked_at`, `replaced_by_id`).
- Decorators: `@Public()`, `@Roles([...])`, `@CurrentUser()`, `@ClientIp()`, `@UserAgent()`, `@NoInternalKey()`.

## Database

- Schema split (`prisma/`): `datasource.prisma`, `generator.prisma` (client → `generated/prisma`, CommonJS),
  `models/*.prisma`. Ids are `uuidv7()` (PostgreSQL 18), columns `snake_case`, tables plural.
- Invariants Prisma cannot express are CHECK constraints at the end of the migration SQL (singleton
  settings, rating 1..10, price ≥ 0, media dimensions and key layout, locale codes, slugs, normalized
  logins, admin credentials, refresh-token hash format …).
- New migration: edit `models/*.prisma` → `npm run prisma:migration -- --name <name>` → add CHECKs to the
  generated `migration.sql` → `npm run prisma:deploy`.

## Seed

`npm run db:seed` (`src/cli/seed.ts`; the steps, in order, in `src/cli/seed/seed.steps.ts`) — idempotent: a
second run changes nothing (the rules of the seed the site had before the backend existed):

1. **Admin** (`AdminUserSeed`): created from `ADMIN_LOGIN` / `ADMIN_PASSWORD`, or the oldest ADMIN brought
   in line with them (a new password ends its sessions). It owns the seed images.
2. **Scope** (`SeedScopeSeed`): a first run (no site settings row yet) or `SEED_OVERWRITE=1` seeds
   everything; on a seeded database only what is missing and listed below.
3. **Site texts** (`SiteMessagesSeed`): every key of `shared/messages/<locale>.json` × every locale → a
   `messages` row. Missing rows are created; rows still holding a seed value (`edited_at` null) follow a
   changed default; rows edited in the admin are kept; rows of removed keys / locales (orphans) are
   reported in the log, never deleted. The running server sees the change when its texts cache expires
   (≤ 5 min).
4. **Seed images** (`SeedMediaSeed`): `assets/{photos,brandbook}/*` → WebP (≤ 2400 px, q84) → MinIO
   `admin/<adminId>/<uuid>/image.webp` + a `media` row. The uuid is derived from the image name and the
   source bytes (version 8: a re-run finds its row and object; a changed asset gets a new uuid = a new
   immutable URL; an object already in the bucket is reused, a lost one restored). Every image on a full
   run, otherwise only those of content image keys without a row. Alt texts (`MediaAltSeed`) come from
   `shared/messages/content/<locale>.json` `mediaAlt` and are written only where still empty.
5. **Landing images** (`ContentImagesSeed`): a `content_images` row for every missing key.
6. **Demo content** (`DemoEntitiesSeed`, full runs only): the collection «Меня запомнят» with 4 products,
   3 reviews, 2 news, 6 gallery items, 2 offers, 3 partner drafts, the menu, a Telegram link and the site
   settings (placeholder contacts, 5-star reviews) — texts from `shared/messages/content/<locale>.json`.
   The settings row is written last: it marks the database as seeded, so the demo content is never
   touched again (deleted or renamed rows stay deleted / renamed).

`SEED_OVERWRITE=1 npm run db:seed` resets every seeded row to the seed copy (texts with `edited_at`
cleared, alt texts, landing images, demo rows — deleted ones come back, product photos as in the seed; a
changed asset gets its new image and the rows are re-pointed at it). Nothing is ever deleted except
product photos under overwrite; orphan texts and older images stay. The bucket must exist (`minio-init`
of `docker-compose.yml` creates it). Tests: `npm run test:slice -- seed` (the e2e builds its own database
`<POSTGRES_NAME>_seed_e2e` and removes its MinIO objects).

## Production (Docker)

The whole stack (frontend, backend, PostgreSQL, MinIO, reverse proxy) starts with one script from the
repository root: [../README.md](../README.md). This folder's part:

- `Dockerfile` (build context = the repository root). Target `runtime`: compiled `dist` + production
  dependencies + `shared/messages` + `assets`, user `node`, `node dist/backend/src/main.js` — also the image
  of the `seed` service (`node dist/backend/src/cli/seed.js`). Target `migrate`: the build stage with the
  Prisma CLI — `prisma migrate deploy` as the database owner, then `docker/app-db-role.mjs`, which creates
  / updates the role the server connects as (`APP_DB_USER`: rows only, no DDL, nothing on
  `_prisma_migrations`).
- Compose runs `migrate` → `seed` → backend on every `docker compose up`: the seed is idempotent (new
  default texts, the admin from `ADMIN_LOGIN` / `ADMIN_PASSWORD`, admin edits kept);
  `docker compose run --rm -e SEED_OVERWRITE=1 seed` resets the seeded rows.
- The server runs with `NODE_ENV=prod`, `APP_HOST=0.0.0.0`, `LOG_DIR=/var/log/gadyuka` (a volume) and never
  publishes its port: the reverse proxy routes only `/media/*` to it, the API is called by the Next.js server.

## Generator

```bash
npm run gen:usecase                                            # asks for group, feature, method
npm run gen:usecase -- --group admin --feature news-items --method get
npm run gen:usecase -- --group admin --slice catalog --feature collections --method post
```

Creates `src/usecases/<group>/[<area>/]<feature>/<method>/` (controller, usecase, repository, dto,
response, route, e2e test) and prints the lines to add to the module — the area module with
`--slice <area>` (`src/usecases/<group>/<area>/*.module.ts`), otherwise the group module. Templates:
`_templates/usecase/new/`.

## Areas (feature modules)

Every API area has its own feature module; the group modules (`public.module.ts`, `admin.module.ts`)
import them — a new endpoint is registered in its area's module only (`npm run gen:usecase` prints the
lines):

| Area                                         | Module                                                                                                                                         |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| public content                               | `src/usecases/public/content/content.module.ts` (`PublicContentModule`)                                                                        |
| leads                                        | `src/usecases/public/leads/leads.module.ts`, `src/usecases/admin/leads/admin-leads.module.ts` (+ `src/module/lead-notification`: send + store) |
| site texts + dashboard                       | `src/usecases/admin/site-texts/site-texts.module.ts`, `src/usecases/admin/dashboard/dashboard.module.ts`                                       |
| catalog                                      | `src/usecases/admin/catalog/catalog.module.ts`                                                                                                 |
| content entities                             | `src/usecases/admin/content/content.module.ts` (`AdminContentModule`)                                                                          |
| media library                                | `src/usecases/admin/media/admin-media.module.ts`                                                                                               |
| list operations (publish / reorder / delete) | `src/usecases/admin/entities/entities.module.ts`                                                                                               |
| seed                                         | `src/cli/seed/**` + the ordered list `src/cli/seed/seed.steps.ts`                                                                              |

Shared code: domain rules of several areas in `src/core` (`locales/localized-text-value.ts` — reading
and storing translations, `reviews/review-rating-scale.ts`, `entities/list-position.ts`,
`links/site-href.ts`, `constants/slug.constants.ts`, `constants/site-settings.constants.ts`); helpers of
the admin forms in `src/usecases/admin/common` (`RowIdPipe` for `:id`, `LocalizedTextField` /
`TextValidators` / `TextTransform` for DTOs, `MediaRefRecord` + `MediaRefResponse` for picked pictures,
`PickedMediaChecker` via `AdminCommonModule`). Message keys: the general ones in
`src/core/constants/admin-message-key.enum.ts`, an area's own in `src/core/constants/<area>-message-key.enum.ts`
(`src/test/message-keys.test.ts` checks every `*-message-key.enum.ts` against `shared/messages`). Contracts:
`shared/contracts/<area>.ts` (its README has the end-to-end steps of a new endpoint).

## Tests

`node:test` on the compiled `dist/` (no jest / vitest / supertest). Unit tests (`*.test.ts`) need nothing;
e2e tests (`*.e2e.test.ts`) boot the real app (`src/test/e2e/TestApp`) on a random port against the
docker-compose Postgres (database `gadyuka_test`) and MinIO, call it with `fetch` and clean up after
themselves. `npm test` runs both: the unit tests in parallel, then the e2e files one at a time
(`--test-concurrency=1` — they share one database, and counters such as the dashboard's are global).
`src/test/route-access.e2e.test.ts` checks the access rules on EVERY
route of the app (new ones included): only `GET|HEAD /media/*` works without `x-internal-key`, `@Public()`
only under `/api/v1/public/*`, `/media/*` and login / refresh / logout, every admin route (a route of
`AdminModule` or of an area module it imports, or any path under `/api/v1/admin`) needs `@Roles([ADMIN])`
and really answers 401 without a session and 403 to a signed-in USER. `src/swagger/swagger.setup.e2e.test.ts`
checks that the dev Swagger document describes every API route.

### Isolated runs per area

```bash
npm run test:slice -- catalog                                  # the area's default folders
npm run test:slice -- catalog 'usecases/admin/catalog/collections/**/*.e2e.test.js'
npm run test:slice -- my-topic module/site-messages test       # any name + explicit folders / globs
```

`scripts/test-slice.sh <name> [pattern …]` compiles with `tsc` + `tsc-alias` into `.build/<name>/`
(gitignored; never touches `dist/` or `generated/` — run `npm run prisma:prepare` first if the schema
changed), migrates its own database `gadyuka_test_<name>` on the dev Postgres (`prisma migrate
deploy` creates it when missing) and runs `node --test` on the compiled tests of the patterns with
`POSTGRES_NAME=gadyuka_test_<name>` (the process environment wins over `.env` / `.env.test`).
Patterns are relative to `src/`: a folder (= its `**/*.test.js`) or a glob ending in `.js`. Default
folders (`scripts/test-slice.sh`): `entities`, `content` (public content), `leads`, `site-texts` (+ dashboard),
`catalog`, `content-entities`, `media` — each its usecases plus its `src/core` folder (and
`usecases/admin/common` for catalog / content entities, `module/lead-notification` for leads,
`module/site-messages` for site texts) —, `seed` → `cli`, `policy` → `test` + `swagger` (access rules,
message keys, module wiring, Swagger), `all` → everything. Different names run at the same time; the same
name twice is refused (lock folder `.build/<name>.lock`). Tests inside one run go in parallel (fast, for
work in progress); `npm test` is the reference run. MinIO is shared: tests use unique keys and clean up.

## Git hooks

Husky lives in `backend/.husky` but works for the whole repository (`npm ci` here runs
`husky:prepare` = `cd .. && husky backend/.husky`, which sets `core.hooksPath`). Git runs hooks from the
repository root:

- **pre-commit**: `backend/node_modules/.bin/lint-staged`. lint-staged finds every config of the
  repository and runs each in its own folder: `backend/.lintstagedrc.json` for `backend/**`, the root
  `.lintstagedrc.json` for `frontend/**` (the frontend's own oxfmt / oxlint via
  `backend/.husky/lib/run-in-package.sh`) and `shared/**` (the backend's tools). When the frontend gets
  its own `.lintstagedrc.json`, it takes over `frontend/**` automatically (the closest config wins).
- **commit-msg**: commitlint (Conventional Commits, `backend/.commitlintrc.json`).
- **pre-push**: `npm run lint:check` of the backend, and `npm run lint` of the frontend when it is installed.

Skipping hooks (`--no-verify`) is not allowed. `npm ci` in `backend/` installs the hooks; from then on every
commit of the repository (frontend-only ones too) needs `backend/node_modules` — without it the hooks stop
with a hint to run `npm ci`.

## Shared code

- `../shared/messages` — the site and admin texts (JSON, ru/en). The backend reads them at startup
  (`src/module/messages`): message keys of errors, Telegram texts, ICU validation of admin-edited texts.
- `../shared/messages/meta/site-texts.json` — section order, kinds, required flags and landing images of
  the site texts (`src/core/site-texts/site-text-registry.ts` imports it; the frontend reads it too).
- `../shared/contracts` — TypeScript types of every request and response (type-only; see its README —
  also the end-to-end steps of a new endpoint).