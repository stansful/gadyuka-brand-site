<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project rules (ГАДЮКА)

- **Display only.** The frontend renders and forwards; every read and write goes to the NestJS backend (`../backend`) through `src/lib/api/` (README there): public data `publicRead` (request time + `'use cache'` + `cacheTag('content')` — `next build` never calls the backend), admin pages `readAdminData` / `readAdminRow` (`src/lib/api/admin-read.ts`), admin Server Actions `adminApiAction`. Request / response types: `@shared/contracts/*`. Rules, validation, the database, media storage and Telegram are the backend's: no Prisma / S3 / sharp / zod / Telegram code and no validation rules here (`test/client-imports.test.ts` fails on backend packages). The server code left here is Next plumbing only: the API client, session cookies + `src/proxy.ts`, the `/media` and `/api/leads` forwarding routes, the admin upload route, next-intl config, cached reads.
- **New feature.** Contract (`shared/contracts/<area>.ts`) → backend usecase (`npm run gen:usecase` in `../backend`) → the call here — step by step in `../shared/contracts/README.md` («Adding an endpoint end to end»).
- **Text.** No user-visible string is hard-coded. Site UI copy → `shared/messages/ru.json` + `shared/messages/en.json` at the repository root (`@shared/messages/*`; same key set; seeded into the `Message` table by the backend and editable in the admin «Тексты сайта»; kinds / required flags / section order in `shared/messages/meta/site-texts.json`); admin UI → `shared/messages/admin/ru.json`; seed demo content → `shared/messages/content/<locale>.json`. Full procedure: skill `.claude/skills/site-texts/SKILL.md` at the repository root — load it for any task that adds or changes text.
- **Media.** Images are uploaded through the backend (S3/MinIO, key `<admin|user>/<ownerId>/<uuid>/image.webp`, public link `Media.url` = `/media/<key>`, streamed by `src/app/media/[...key]` from the backend). Never write uploads to the local disk or `public/`; `public/brand` is only for the static brand art.
- **Data.** Links, phones, menu, socials, star scale and texts are data edited in the admin — never constants in code. Public-content writes end with `updateTag('content')` (`adminApiAction({ revalidatesContent: true })` / `revalidateContent()`).
- **Admin access.** Every admin route needs a signed-in admin (backend account, httpOnly session cookies, `src/proxy.ts` refreshes once): pages `requireAdminPage`, route handlers `requireAdminRoute` (`src/lib/admin/auth.ts`); Server Actions rely on the backend's check of every call (a 401 becomes «Сессия истекла…»).
- **Tooling.** oxlint + oxfmt (`npm run lint`, `npm run format`), no ESLint/Prettier; TypeScript strict without `any`.
- **Local services.** Only the backend (`../backend`: `docker compose up -d`, `npm run db:seed`, `npm run start:dev` → `http://127.0.0.1:4000`); this app's `.env` needs `BACKEND_URL` + `INTERNAL_API_KEY` (+ `SITE_URL`). Run the dev server on `localhost` (`next dev -H localhost`), not `127.0.0.1` — next-intl's rewrite of `/` targets `localhost`.
