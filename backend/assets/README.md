# Seed image sources

Read-only sources of the seed images (`npm run db:seed`, `src/cli/seed`): the seed encodes a WebP copy
of each one into MinIO and never changes these files. Moved here from `frontend/assets` (the brand
vectors and cut-outs of `frontend/assets/{vector,cutout}` stay with the frontend: its brand scripts
read them).

- `photos/` — brand photos (products, packaging, labels, the workshop);
- `brandbook/` — the 16 brandbook slides, `01-wordmark-on-black.jpg` = «изображение №1».

Which file is which seed image: `src/cli/seed/data/seed-media.sources.ts`. Editing a used file gives
that image a new uuid (a new URL) on the next `SEED_OVERWRITE=1` run; without it a seeded database
keeps the older image.