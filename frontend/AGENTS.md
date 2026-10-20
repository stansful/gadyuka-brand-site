<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project rules (ГАДЮКА)

- **Text.** No user-visible string is hard-coded. Site UI copy → `messages/ru.json` + `messages` (same key set; seeded into the `Message` table and editable in the admin «Тексты сайта»); admin UI → `messages`; seed demo content → `messages`. After adding keys run `npm run db:seed`. Full procedure: skill `.claude` — load it for any task that adds or changes text.
- **Media.** Images are uploaded to S3/MinIO only (`src/lib/storage`, key `<admin|user>/<ownerId>/<uuid>/image.webp`, public link `Media.url` = `/media/<key>`). Never write uploads to the local disk or `public`; `public` is only for the static brand art.
- **Data.** Links, phones, menu, socials, star scale and texts are DB data edited in the admin — never constants in code. Public-content writes call `revalidateContent()`.
- **Tooling.** oxlint + oxfmt (`npm run lint`, `npm run format`), no ESLint/Prettier; TypeScript strict without `any`.
- **Local services.** `npm run db:up` starts Postgres + MinIO (`docker-compose.dev.yml`); MinIO console http://127.0.0.1:9001.
