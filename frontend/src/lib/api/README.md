# src/lib/api — the backend client (server-only)

The frontend is display-only: every read and write goes to the NestJS backend (`../backend`) through
this folder. Types of requests / responses: `@shared/contracts/*` (one file per area, see
`shared/contracts/README.md` — also the end-to-end steps of a new endpoint). Environment: `BACKEND_URL`,
`INTERNAL_API_KEY` (`backend-env.ts`, checked by hand per call — `next build` needs neither).

| Module                                                                                               | Use it from                                 | What                                                                                                 |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `client.ts`                                                                                          | anywhere on the server                      | `apiRequest<T>(path, { method, body, formData, query, accessToken, visitor })` → `ApiResult<T>`      |
| `api-result.ts`                                                                                      | isomorphic types                            | `ApiResult`, `ApiFailure` (`validation` / `domain` / `unavailable`), `ApiRequestError`               |
| `public.ts`                                                                                          | server components, metadata, route handlers | `publicRead<T>(path)` — request-time + cached `'content'`; `cachedPublicRead` inside "use cache"     |
| `admin.ts`                                                                                           | admin queries, actions, route handlers      | `adminRequest<T>(path, options)` (access cookie + visitor), `getAdminSession()`                      |
| `admin-read.ts`                                                                                      | `src/lib/admin/queries/*`                   | `readAdminData<T>(path, { query })` (failure throws), `readAdminRow<T>(path)` (null on 404 / bad id) |
| `admin-action.ts`                                                                                    | admin Server Actions                        | `adminApiAction(label, request, { revalidatesContent, onSuccess, fieldErrors })` → `ActionResult`    |
| `admin-messages.ts`                                                                                  | server                                      | `translateAdminMessage(ref)`, `describeAdminFailure(failure)`                                        |
| `visitor.ts`, `client-ip.ts`                                                                         | request scope (never inside "use cache")    | `getVisitor()` → `{ clientIp, userAgent }` for calls made for a visitor (leads, login)               |
| `entities.ts`                                                                                        | `src/lib/admin/actions/entities.ts`         | publish / reorder / delete of list rows (`/admin/entities/*`)                                        |
| `content-entities.ts`                                                                                | content entity actions                      | `saveContentEntity(path, id, body)` — POST (new) or PUT (update)                                     |
| `leads.ts`                                                                                           | `/api/leads`, lead queries and actions      | the public lead submit and the admin lead calls                                                      |
| `media.ts`                                                                                           | the admin media routes and actions          | upload stream, library page, details, alt, delete                                                    |
| `auth.ts`, `session-cookies.ts`, `session-refusals.ts`, `refresh-single-flight.ts`, `admin-proxy.ts` | sign-in actions, `src/proxy.ts`             | the admin session (do not call `refreshSession` anywhere else); which failures end it                |
| `media-proxy.ts`                                                                                     | `src/app/media/[...key]/route.ts`           | GET / HEAD `/media/<key>` streamed from `${BACKEND_URL}/media/<key>`                                 |

## Public data — the request-time rule

```ts
import { publicRead } from '@/lib/api/public';
import type { LandingResponse } from '@shared/contracts/content';

const landing = await publicRead<LandingResponse>(`/api/v1/public/landing/${locale}`);
```

- `publicRead` = `await connection()` (outside the cache: prerendering stops there, so `next build`
  never calls the backend) + `cachedPublicRead` (`'use cache'` + `cacheTag('content')` +
  `cacheLife('hours')`). A failure throws `ApiRequestError` and is never cached.
- Inside your own `'use cache'` function call `cachedPublicRead` (not `publicRead`: `connection()`
  is not allowed in a cache scope) — and make sure that function's caller went through
  `publicRead` / `connection()` first.
- `generateStaticParams` runs at build time: never call the backend there (return the placeholder
  param; pages render on request anyway — the `[locale]` root layout declares `instant = false`).
- `generateMetadata`, `sitemap.ts`, `manifest.ts`: `publicRead` (or `await connection()` first).
- Example in place: the site messages (`src/i18n/site-messages.ts` → `GET /api/v1/public/messages/:locale`,
  bundled defaults while the backend is down).

## Admin pages and actions

```ts
// page / data function (src/lib/admin/queries/<area>.ts), after requireAdminPage()
const collection = await readAdminRow<AdminCollectionDetailsResponse>(`/api/v1/admin/collections/${id}`);
if (!collection) notFound();
const list = await readAdminData<AdminCollectionListResponse>('/api/v1/admin/collections');

// Server Action ('use server' file)
export async function saveCollection(id: string, input: CollectionInput): Promise<ActionResult<{ id: string }>> {
  return adminApiAction(
    'saveCollection',
    () => adminRequest<CollectionSaved>(`/api/v1/admin/collections/${id}`, { method: 'PUT', body: input }),
    {
      revalidatesContent: true,
      onSuccess: async data =>
        actionOk({ id: data.id }, await translateAdminMessage({ key: 'admin.collections.saved' })),
      // a refusal the form also shows at its field (key: the field's own message)
      fieldErrors: { 'admin.errors.slugTaken': { field: 'slug', key: 'admin.collections.slugTaken' } },
    },
  );
}
```

- Validation errors come back as `fieldErrors` keyed by the backend's dotted paths (`title.en`),
  translated from their `admin.validation.*` keys with their values; other errors as their key's
  text; 401 as «Сессия истекла…»; an unreachable backend as «Не удалось выполнить действие».
- `revalidatesContent: true` for every write the public site shows (→ `updateTag('content')`).
  When the outcome is unknown (no usable answer — timeout, reset connection, a proxy's 502 page —, a
  5xx, a throw) the write may still have landed: the site's cache is then marked stale
  (`markContentStale()`, stale-while-revalidate — not `updateTag`, which would re-render the admin page
  against the backend that has just failed). Route Handlers (uploads) call `revalidateContentFromRoute()`
  (`src/lib/content/cache.ts`) instead.
- Timeouts: every call waits `ApiRequestTimeoutMs` (`@shared/contracts/http`, 10 s; the backend keeps a
  request's budgets below it). A route that takes longer names its own bound in its contract and passes
  it as `timeoutMs` (the Telegram re-send: `LeadResendTimeoutMs`; the site-text writes:
  `SiteTextsWriteTimeoutMs`, 45 s for the backend's 35 s transaction).
- An admin page whose data does not come shows `src/app/admin/(panel)/error.tsx` (inside the frame); a
  failing frame or login page — `src/app/admin/error.tsx`.
- The backend checks the session and the ADMIN role on every call; pages still call
  `requireAdminPage()` first (redirect to the login page instead of an error), route handlers
  `requireAdminRoute(request)`.
- `/admin/api/*` route handlers are outside the proxy (uploads must not be buffered), so their access
  token is not refreshed there: on a 401 the client should reload the page (that refreshes it).

## Admin session

- Login: `src/lib/admin/actions/auth.ts` → `POST /auth/login` → httpOnly cookies
  `gadyuka_admin_access` / `gadyuka_admin_refresh` (Path=/, SameSite=Lax, Secure in production,
  Max-Age = the backend's expiries). Logout: `POST /auth/logout` + cookies deleted.
- `src/proxy.ts` → `admin-proxy.ts`: an expired access cookie (by its `exp` claim) + a refresh
  cookie → ONE refresh per refresh token (`RefreshSingleFlight`, results reused for 30 s), new
  cookies on the response and on the forwarded request; no session → 307 to `/admin/login?next=…`
  for page loads. The backend revokes the whole session when a spent refresh token comes back, so
  nothing else may call `/auth/refresh`.
- `requireAdminPage` / `requireAdminRoute` (`src/lib/admin/auth.ts`) ask the backend (`GET /auth/me`,
  once per request) — a logout or a revoked session ends access at once. Only a refused token
  (`session-refusals.ts`) counts as signed out; a 5xx, a mismatched internal key or no answer is an
  outage (error page; the login page shows its form with a notice) and never deletes the cookies. Server Actions need no check of
  their own: the backend answers 401 to every call without a valid session («Сессия истекла…»).
