### API groups

> Requests are split into logical groups; every group is a Nest module that lists its controllers
> and usecases. Every route needs `x-internal-key` (only the Next.js server calls the backend), except
> `GET|HEAD /media/*`.

| Group      | Prefix             | Access                                                                    |
| ---------- | ------------------ | ------------------------------------------------------------------------- |
| **public** | `/api/v1/public/*` | `@Public()`: the site's server components and actions (no signed-in user) |
| **public** | `/media/*`         | `@Public()` + `@NoInternalKey()`: media files for browsers / next/image   |
| **auth**   | `/api/v1/auth/*`   | admin sign-in: login / refresh / logout are public, `me` needs a session  |
| **admin**  | `/api/v1/admin/*`  | `@Roles([UserRole.ADMIN])` on every controller: the admin panel           |

Layout of one usecase: `<group>/<feature>/<http method>/` with `<feature>.controller.ts`,
`.usecase.ts`, `.repository.ts`, `.dto.ts`, `.response.ts`, `.route.ts` and `<feature>.e2e.test.ts`
(`npm run gen:usecase`, see backend/README.md).

Every vertical slice owns a feature module inside its group (`public/content`, `public/leads`,
`admin/{entities,dashboard,site-texts,catalog,content,media,leads}`) — `public.module.ts` and
`admin.module.ts` import them all; a slice registers its controllers and providers in its own module
only (`npm run gen:usecase -- --group admin --slice catalog …`, table in backend/README.md «Slices»).