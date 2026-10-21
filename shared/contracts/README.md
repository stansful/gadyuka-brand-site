# shared/contracts

TypeScript types of every request and response of the backend API — the single description both
sides compile against:

- **backend** (`~shared/contracts/*`): response classes `implements` the response interfaces, DTO
  classes the request ones, so a change that breaks the contract fails `npm run build`;
- **frontend** (`@shared/contracts/*`): the typed server-side API client (`frontend/src/lib/api/`),
  the admin queries and actions, the view models of the pages.

Rules:

- **types only**: `interface` / `type`, imported with `import type` (no runtime code, no
  dependencies). Enumerations are string unions (`'ADMIN' | 'USER'`), not `enum`; when a runtime
  list is needed, it lives next to its user (`frontend/src/lib/lead-intent.ts` `LEAD_TYPES`, a backend
  enum in `src/core`) and is checked against the union;
- dates travel as ISO 8601 strings, ids as strings (UUID v7);
- user-facing text never travels as prose: errors carry a message **key** of `shared/messages`
  plus ICU `values` (`errors.ts`), the frontend translates;
- `index.ts` re-exports every file (`export type * from …`); import from the area file
  (`@shared/contracts/catalog`) or from the index. Type names are unique across the files.

## One file per API area

| File                   | Area                                                                     |
| ---------------------- | ------------------------------------------------------------------------ |
| `common.ts`            | `Locale`, `LocalizedText`, `ImageRef`, `MediaRef`, pagination, ids/dates |
| `errors.ts`, `http.ts` | error bodies, transport headers, the client's request timeout            |
| `auth.ts`              | `/auth/*`                                                                |
| `health.ts`            | `/public/health`                                                         |
| `content.ts`           | public site content `/public/*` (landing, messages, collections …)       |
| `leads.ts`             | `/public/leads`, `/admin/leads`                                          |
| `entities.ts`          | shared list operations `/admin/entities/*` (publish, reorder, delete)    |
| `catalog.ts`           | `/admin/{collections,products,reviews,settings}`                         |
| `content-entities.ts`  | `/admin/{news,gallery,offers,partners,menu-items,social-links}`          |
| `site-texts.ts`        | `/admin/site-texts/*`, landing images                                    |
| `dashboard.ts`         | `/admin/dashboard`                                                       |
| `media.ts`             | `/admin/media`                                                           |

A type more than one area needs goes to `common.ts` or is imported from the owning file with
`import type`.

## Adding an endpoint end to end

The frontend renders and forwards; the rule, the data and the validation live in the backend. A new
feature goes contract → backend usecase → frontend call:

1. **Contract** — add the request / response types to the area file here (a new area: a new file plus
   its line in `index.ts` and in the table above).
2. **Backend** (`backend/`, rules: `docs/CLAUDE.md`):
   - generate the endpoint folder: `npm run gen:usecase -- --group admin --slice catalog --feature
     collection-archive --method post` (`--group public` for the site, `--slice` = the area folder of
     `src/usecases/<group>/`) — controller, usecase, repository, DTO, response, route constant, e2e test;
   - register it in the area module the generator names (e.g. `usecases/admin/catalog/catalog.module.ts`);
   - DTO: class-validator decorators with `ValidationMessage.of(<key>, values)` and `implements` the
     request type; response class `implements` the response type; shared admin helpers (`RowIdPipe`,
     `LocalizedTextField`, `MediaRefRecord` / `MediaRefResponse`, `PickedMediaChecker`) are in
     `src/usecases/admin/common/`;
   - errors: a domain exception with a message key; new keys go to `shared/messages/admin/ru.json` (or the
     site files) and to the area's `src/core/constants/<area>-message-key.enum.ts` (the message-key test
     checks them);
   - admin routes: `@Roles([UserRole.ADMIN])` on the controller (the route-access test calls every route);
     public ones: `@Public()` under `/api/v1/public/*`;
   - add the route to the API table of `backend/README.md`; run `npm run lint`, `npm run test:slice --
     <area>` while working, `npm test` before finishing.
3. **Frontend** (`frontend/`, `src/lib/api/README.md`):
   - an admin page reads with `readAdminData<T>(path)` / `readAdminRow<T>(path)`
     (`src/lib/api/admin-read.ts`) from its area's `src/lib/admin/queries/<area>.ts`, after
     `requireAdminPage()`;
   - an admin form saves through a Server Action: `adminApiAction(label, () => adminRequest<T>(path,
     { method, body }), { revalidatesContent, onSuccess, fieldErrors })` — validation errors come back as
     translated `fieldErrors`, domain refusals as the toast (and at a field, via `fieldErrors`);
   - the public site reads with `publicRead<T>(path)` at request time (never from
     `generateStaticParams`);
   - types from `@shared/contracts/<area>`, texts through `translateAdminMessage` / next-intl; no
     validation rules, database or storage code in the frontend (`test/client-imports.test.ts` guards
     the packages).
