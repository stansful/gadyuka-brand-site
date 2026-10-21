# shared

Code and data both apps use. No package of its own: each app reads it from here
(backend: alias `~shared/*`, frontend: `@shared/*`); the production images are built from the
repository root, so the folder is available to both.

- `messages/` — UI texts: `ru.json`, `en.json` (site, the defaults of the editable `Message` rows),
  `admin/ru.json` (admin UI), `content/*.json` (demo copy of the seed). Error responses of the backend
  carry keys of these files; the frontend translates them.
- `messages/meta/site-texts.json` — what the texts cannot say about themselves: the admin's section
  order, the kind (`richtext`, `template` — filled in by a client component, `link`) and the `required`
  flag of a text, the landing images. The backend validates admin edits and seeds with it
  (`src/core/site-texts/site-text-registry.ts`); the frontend reads the landing image keys and tests what
  the site renders against it.
- `contracts/` — TypeScript types of the backend API (requests, responses, error bodies). Type-only,
  see [contracts/README.md](contracts/README.md) — also the end-to-end steps of a new endpoint.
