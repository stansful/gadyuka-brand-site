# Visitor metrics implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add anonymous visitor metrics to the site: record unique visits per hour, expose admin stats/recent endpoints, and build `/admin/visits` page with an SVG chart and filters.

**Architecture:** A NestJS interceptor on public content endpoints writes one row per `(hourBucket, hashedIp)`. Admin endpoints aggregate by hour or day with raw SQL. The Next.js admin page renders an SVG chart driven by URL filters.

**Tech Stack:** NestJS, Prisma/PostgreSQL, Next.js 16, React 19, Tailwind CSS, no chart libraries.

**Spec:** `docs/superpowers/specs/2026-11-04-visitor-metrics-design.md`

## Global Constraints

- No new runtime dependencies (chart library, analytics SDK, etc.).
- Contracts first: change `shared/contracts/*`, then backend, then frontend.
- All user-facing copy lives in `shared/messages/admin/ru.json` and `en.json`; load `.claude/skills/site-texts/SKILL.md` before adding strings.
- Store only the HMAC of the visitor's network, never the raw IP.
- Every admin endpoint requires `@Roles([UserRole.ADMIN])`.
- Tracking must not fail the public response on DB errors.
- Prisma migration must be created with `npm run prisma:migration` in `backend/`.

## Review Focus

1. **Same IP within the same hour** must create only one `Visit` row (upsert path).
2. **Same IP on two different hours** must count as two visits in hour-mode and one in day-mode.
3. **Visitor IP forwarding** must use `x-client-ip` header, not the transport connection IP.
4. **Admin-only access** on `/admin/visits/*` endpoints must reject non-admin users (401/403).
5. **Public response must not wait for tracking DB write** — fire-and-forget with error logging.

---

## File map

### Backend

- `backend/prisma/models/visit.prisma` — new model.
- `backend/src/module/common/src/client-ip/visitor-ip.hasher.ts` — moved from leads; reusable IP-network HMAC hasher.
- `backend/src/usecases/public/leads/lead-submission/post/lead-submission.usecase.ts` — update import to common hasher.
- `backend/src/usecases/public/leads/lead-submission/post/lead-submission.test.ts` — update import to common hasher.
- `backend/src/usecases/public/content/common/visit-tracking.interceptor.ts` — interceptor that upserts a visit row.
- `backend/src/usecases/public/content/content.module.ts` — register interceptor as `APP_INTERCEPTOR`.
- `backend/src/usecases/admin/visits/common/visit.repository.ts` — aggregation and recent queries.
- `backend/src/usecases/admin/visits/stats/get/visits-stats.route.ts`, `controller.ts`, `dto.ts`, `usecase.ts`, `response.ts` — `GET /api/v1/admin/visits/stats`.
- `backend/src/usecases/admin/visits/recent/get/visits-recent.route.ts`, `controller.ts`, `usecase.ts`, `response.ts` — `GET /api/v1/admin/visits/recent`.
- `backend/src/usecases/admin/visits/visits.module.ts` — imports repository, registers controllers/providers.
- `backend/src/usecases/admin/admin.module.ts` — import `VisitsModule`.
- `backend/src/usecases/admin/dashboard/dashboard/get/dashboard.repository.ts` — add `countVisitsToday()` / `countVisitsYesterday()`.
- `backend/src/usecases/admin/dashboard/dashboard/get/dashboard.usecase.ts` — include visits in response.
- `backend/src/usecases/admin/dashboard/dashboard/get/dashboard.response.ts` — add `visits` field.

### Shared contracts

- `shared/contracts/visits.ts` — new types for stats/recent.
- `shared/contracts/index.ts` — export `visits`.
- `shared/contracts/dashboard.ts` — add `visits` to `DashboardResponse`.

### Frontend

- `frontend/src/lib/admin/queries/visits.ts` — fetchers for stats and recent.
- `frontend/src/app/admin/(panel)/visits/page.tsx` — page with filters, chart, table.
- `frontend/src/components/admin/visits/VisitsFilters.tsx` — date range, granularity, chart type.
- `frontend/src/components/admin/visits/VisitsChart.tsx` — SVG line/bar chart with tooltip.
- `frontend/src/components/admin/visits/VisitsTable.tsx` — recent visits list.
- `frontend/src/app/admin/(panel)/page.tsx` — add visits widget.
- `frontend/src/components/admin/layout/AdminSidebar.tsx` — add `/admin/visits` nav item.
- `shared/messages/admin/ru.json`, `en.json` — new keys.

### Tests

- `backend/src/usecases/public/content/common/visit-tracking.interceptor.test.ts` — unit test for upsert logic and error swallowing.
- `backend/src/usecases/admin/visits/stats/get/visits-stats.e2e.test.ts` — end-to-end stats aggregation.
- `backend/src/usecases/admin/dashboard/dashboard/get/dashboard.e2e.test.ts` — update/extend to assert visits counts.

---

## Task 1: Move IP hasher to common and create Prisma model

**Files:**
- Create: `backend/prisma/models/visit.prisma`
- Create: `backend/src/module/common/src/client-ip/visitor-ip.hasher.ts`
- Delete: `backend/src/usecases/public/leads/lead-submission/post/visitor-network.hasher.ts`
- Modify: `backend/src/module/common/index.ts`, `backend/src/usecases/public/leads/lead-submission/post/lead-submission.usecase.ts`, `backend/src/usecases/public/leads/lead-submission/post/lead-submission.test.ts`
- Test: `backend/src/usecases/public/leads/lead-submission/post/lead-submission.test.ts`

**Interfaces:**
- Produces: `VisitorIpHasher.hashOf(clientIp: string): string` exported from `~module/common`.
- Produces: Prisma `Visit` model.

- [ ] **Step 1: Create `visit.prisma`**

```prisma
model Visit {
  id         String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  hourBucket DateTime @map("hour_bucket")
  ipHash     String   @map("ip_hash")
  firstAt    DateTime @default(now()) @map("first_at")
  lastAt     DateTime @default(now()) @map("last_at")
  userAgent  String?  @map("user_agent") @db.VarChar(512)
  path       String?  @map("path") @db.VarChar(2048)
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  @@unique([hourBucket, ipHash])
  @@index([hourBucket(sort: Desc)])
  @@map("visits")
}
```

- [ ] **Step 2: Move hasher to common**

Move the contents of `visitor-network.hasher.ts` to `backend/src/module/common/src/client-ip/visitor-ip.hasher.ts`, rename class to `VisitorIpHasher`, and update its docstring to say it is generic for visits and leads.

- [ ] **Step 3: Update exports and references**

- Export `VisitorIpHasher` from `backend/src/module/common/index.ts`.
- Update `lead-submission.usecase.ts` import from `./visitor-network.hasher` to `~module/common`.
- Update `lead-submission.test.ts` import similarly.

- [ ] **Step 4: Verify build/tests still pass**

Run: `cd backend && npm run type:check && npm run test:unit`
Expected: PASS (hasher unit test still works, no compile errors).

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/models/visit.prisma backend/src/module/common backend/src/usecases/public/leads/lead-submission/post
git commit -m "refactor(common): move VisitorIpHasher and add Visit prisma model"
```

---

## Task 2: Track visits on public content endpoints

**Files:**
- Create: `backend/src/usecases/public/content/common/visit-tracking.interceptor.ts`
- Modify: `backend/src/usecases/public/content/content.module.ts`
- Test: `backend/src/usecases/public/content/common/visit-tracking.interceptor.test.ts`

**Interfaces:**
- Consumes: `VisitorIpHasher`, `DatabaseService`, `RequestContext` (`clientIpOf`, `userAgentOf`).
- Produces: `VisitTrackingInterceptor` registered as `APP_INTERCEPTOR` in `PublicContentModule`.

- [ ] **Step 1: Write the interceptor**

File: `backend/src/usecases/public/content/common/visit-tracking.interceptor.ts`

```ts
@Injectable()
export class VisitTrackingInterceptor implements NestInterceptor {
  constructor(
    private readonly hasher: VisitorIpHasher,
    private readonly database: DatabaseService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<NodeRequest>();
    const clientIp = RequestContext.clientIpOf(undefined, context);
    const userAgent = RequestContext.userAgentOf(undefined, context);
    const path = request.url ?? null;

    return next.handle().pipe(
      tap(() => {
        this.recordVisit(clientIp, userAgent, path).catch(error => {
          this.logger.error('Failed to record visit', error);
        });
      }),
    );
  }

  private async recordVisit(...): Promise<void> { ... }
}
```

Implementation details:
- Skip when `clientIp === ClientIpResolver.UNKNOWN`? **No** — still record (unknown bucket), but hash `unknown`.
- `hourBucket` = truncate `new Date()` to the start of the hour (UTC).
- `ipHash = this.hasher.hashOf(clientIp)`.
- `firstAt = now`, `lastAt = now`.
- Use `prisma.visit.upsert({ where: { hourBucket_ipHash: { hourBucket, ipHash } }, update: { lastAt }, create: { ... } })`.

- [ ] **Step 2: Register interceptor in `PublicContentModule`**

Add provider:

```ts
{
  provide: APP_INTERCEPTOR,
  useClass: VisitTrackingInterceptor,
}
```

- [ ] **Step 3: Write unit test**

Test: `backend/src/usecases/public/content/common/visit-tracking.interceptor.test.ts`

Cases:
1. First request from an IP creates a `Visit` row with `firstAt === lastAt`.
2. Second request within the same hour updates `lastAt` and does not create a second row.
3. Request in the next hour creates a second row.
4. DB error during upsert does not throw (interceptor logs and resolves).

Use an in-memory stub of Prisma or mock `database.client.visit.upsert`.

- [ ] **Step 4: Verify tests pass**

Run: `cd backend && npm run test:unit -- --test-name-pattern='VisitTracking'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/usecases/public/content
git commit -m "feat(public): track unique visits per hour on public content"
```

---

## Task 3: Admin visits endpoints and repository

**Files:**
- Create: `backend/src/usecases/admin/visits/common/visit.repository.ts`
- Create: `backend/src/usecases/admin/visits/visits.module.ts`
- Create: `backend/src/usecases/admin/visits/stats/get/visits-stats.route.ts`, `controller.ts`, `dto.ts`, `usecase.ts`, `response.ts`
- Create: `backend/src/usecases/admin/visits/recent/get/visits-recent.route.ts`, `controller.ts`, `usecase.ts`, `response.ts`
- Modify: `backend/src/usecases/admin/admin.module.ts`
- Test: `backend/src/usecases/admin/visits/stats/get/visits-stats.e2e.test.ts`

**Interfaces:**
- Consumes: Prisma `Visit` model, `VisitorIpHasher` (for seeding tests), `DatabaseService`.
- Produces:
  - `GET /api/v1/admin/visits/stats?from=YYYY-MM-DD&to=YYYY-MM-DD&granularity=day|hour`
  - `GET /api/v1/admin/visits/recent?limit=20`

- [ ] **Step 1: Define routes**

```ts
// backend/src/usecases/admin/visits/stats/get/visits-stats.route.ts
export const VISITS_STATS_ROUTE = `${API_VERSION}/admin/visits/stats`;

// backend/src/usecases/admin/visits/recent/get/visits-recent.route.ts
export const VISITS_RECENT_ROUTE = `${API_VERSION}/admin/visits/recent`;
```

- [ ] **Step 2: Implement `VisitRepository`**

Methods:

```ts
async upsert(visit: { hourBucket: Date; ipHash: string; userAgent: string | null; path: string | null }): Promise<void>
async countUniqueByDay(from: Date, to: Date): Promise<{ date: string; count: number }[]>
async countUniqueByHour(from: Date, to: Date): Promise<{ hour: string; count: number }[]>
async countUniqueTotal(from: Date, to: Date): Promise<number>
async countToday(): Promise<number>
async countYesterday(): Promise<number>
async findRecent(limit: number): Promise<VisitRecentRow[]>
```

Use `$queryRaw` for date/hour aggregations:
- day: `SELECT date_trunc('day', "hour_bucket")::date AS bucket, count(distinct "ip_hash") FROM visits WHERE "hour_bucket" BETWEEN $1 AND $2 GROUP BY bucket ORDER BY bucket`.
- hour: `SELECT date_trunc('hour', "hour_bucket") AS bucket, count(distinct "ip_hash") FROM visits WHERE "hour_bucket" BETWEEN $1 AND $2 GROUP BY bucket ORDER BY bucket`.
- total: `count(distinct ip_hash)` over the period.

- [ ] **Step 3: Implement controllers / usecases / DTOs**

Stats DTO (`VisitsStatsDto`):
- `from`: `@IsDateString()`
- `to`: `@IsDateString()`
- `granularity`: `@IsEnum(['day', 'hour'])`

Stats response:

```ts
export class VisitsStatsResponse {
  points: { bucket: string; count: number }[];
  total: number;
}
```

Recent response:

```ts
export class VisitsRecentResponse {
  visits: { firstAt: string; lastAt: string; path: string | null; userAgent: string | null }[];
}
```

Controllers decorated with `@ApiBearerAuth()`, `@Roles([UserRole.ADMIN])`, `@ApiTags('admin')`.

- [ ] **Step 4: Wire `VisitsModule` and `AdminModule`**

`VisitsModule` exports nothing; `AdminModule` imports it.

- [ ] **Step 5: Write E2E test**

`backend/src/usecases/admin/visits/stats/get/visits-stats.e2e.test.ts`

Scenario:
1. Create test admin, sign in.
2. Seed visits:
   - IP `A` at 2026-11-01 10:05 and 10:45 (same hour → 1 row).
   - IP `A` at 2026-11-01 11:10 (next hour → second row).
   - IP `B` at 2026-11-01 10:20 (same hour as A's first → 1 row).
3. Query `granularity=hour&from=2026-11-01&to=2026-11-01`:
   - 10:00 bucket count = 2 (A + B).
   - 11:00 bucket count = 1 (A).
4. Query `granularity=day&from=2026-11-01&to=2026-11-01`:
   - count = 2 (A + B).
5. Non-admin user gets 403 on the endpoint.

- [ ] **Step 6: Verify**

Run: `cd backend && npm run type:check && npm run test:e2e -- --test-name-pattern='visits'`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/usecases/admin/visits backend/src/usecases/admin/admin.module.ts
git commit -m "feat(admin): visits stats and recent endpoints"
```

---

## Task 4: Add visits summary to dashboard

**Files:**
- Modify: `backend/src/usecases/admin/dashboard/dashboard/get/dashboard.repository.ts`, `dashboard.usecase.ts`, `dashboard.response.ts`
- Modify: `shared/contracts/dashboard.ts`
- Test: `backend/src/usecases/admin/dashboard/dashboard/get/dashboard.e2e.test.ts`

**Interfaces:**
- Consumes: `VisitRepository` (or add methods to `DashboardRepository`).
- Produces: `DashboardResponse.visits: { today: number; yesterday: number }`.

- [ ] **Step 1: Extend repository**

Add to `DashboardRepository`:

```ts
async countVisitsToday(): Promise<number> {
  const start = startOfDayUTC(new Date());
  return this.database.client.visit.count({ where: { hourBucket: { gte: start, lt: addDays(start, 1) } }, distinct: ['ipHash'] });
}
```

Wait: Prisma `count` with `distinct` on `count` may not support distinct directly. Use `groupBy({ by: ['ipHash'], where: { ... } }).then(rows => rows.length)` or raw query. Document the chosen approach in code.

- [ ] **Step 2: Extend usecase and response**

`DashboardUsecase.execute` fetches `visitsToday` and `visitsYesterday`.
`DashboardResponse` adds `visits` field with Swagger `@ApiProperty`.

- [ ] **Step 3: Update contract**

Add to `DashboardResponse` in `shared/contracts/dashboard.ts`:

```ts
visits: { today: number; yesterday: number };
```

- [ ] **Step 4: Update dashboard E2E test**

Seed a visit for today and assert `dashboard.visits.today === 1`.

- [ ] **Step 5: Verify**

Run: `cd backend && npm run test:e2e -- --test-name-pattern='dashboard'`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/usecases/admin/dashboard shared/contracts/dashboard.ts
git commit -m "feat(admin): visits summary on dashboard"
```

---

## Task 5: Create `shared/contracts/visits.ts`

**Files:**
- Create: `shared/contracts/visits.ts`
- Modify: `shared/contracts/index.ts`

**Interfaces:**
- Produces: `VisitsStatsResponse`, `VisitsRecentResponse`, `VisitsStatsQuery`, `VisitRecentItem`.

- [ ] **Step 1: Write contract types**

```ts
export type VisitGranularity = 'day' | 'hour';

export interface VisitsStatsQuery {
  readonly from: string; // YYYY-MM-DD
  readonly to: string;
  readonly granularity: VisitGranularity;
}

export interface VisitsStatsPoint {
  readonly bucket: string; // ISO date/hour
  readonly count: number;
}

export interface VisitsStatsResponse {
  readonly points: readonly VisitsStatsPoint[];
  readonly total: number;
}

export interface VisitRecentItem {
  readonly firstAt: string;
  readonly lastAt: string;
  readonly path: string | null;
  readonly userAgent: string | null;
}

export interface VisitsRecentResponse {
  readonly visits: readonly VisitRecentItem[];
}
```

- [ ] **Step 2: Export from index.ts**

- [ ] **Step 3: Verify backend uses these types in DTOs/responses**

Run: `cd backend && npm run type:check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add shared/contracts
git commit -m "chore(contracts): visits stats and recent types"
```

---

## Task 6: Frontend queries and admin page

**Files:**
- Create: `frontend/src/lib/admin/queries/visits.ts`
- Create: `frontend/src/app/admin/(panel)/visits/page.tsx`
- Create: `frontend/src/components/admin/visits/VisitsFilters.tsx`
- Create: `frontend/src/components/admin/visits/VisitsChart.tsx`
- Create: `frontend/src/components/admin/visits/VisitsTable.tsx`
- Modify: `frontend/src/components/admin/layout/AdminSidebar.tsx`
- Modify: `shared/messages/admin/ru.json`, `en.json`
- Test: `frontend/src/app/admin/(panel)/visits/page.tsx` typecheck; no new unit tests unless project already tests pages.

**Interfaces:**
- Consumes: `VisitsStatsResponse`, `VisitsRecentResponse`, `VisitsStatsQuery` from `@shared/contracts/visits`.
- Produces: `/admin/visits` page with URL filters (`from`, `to`, `granularity`, `chart`).

- [ ] **Step 1: Add nav item**

In `AdminSidebar.tsx` add `{ href: '/admin/visits', key: 'visits', icon: BarChart3 }` after `leads` (or wherever fits). Add `BarChart3` import from `lucide-react`. Add `visits` key to `Messages['admin']['nav']['items']`.

- [ ] **Step 2: Create fetchers**

`frontend/src/lib/admin/queries/visits.ts`:

```ts
export async function getVisitsStats(query: VisitsStatsQuery): Promise<VisitsStatsResponse> { ... }
export async function getVisitsRecent(limit = 20): Promise<VisitsRecentResponse> { ... }
```

Use `readAdminData` with query params.

- [ ] **Step 3: Build filters component**

`VisitsFilters.tsx` controls:
- Presets: today, 7 days, 30 days.
- Date inputs for custom `from`/`to`.
- Granularity select: `day` / `hour`.
- Chart type select: `line` / `bar`.

All changes update URL search params via `router.push(pathname + '?' + params)`.

- [ ] **Step 4: Build SVG chart component**

`VisitsChart.tsx`:
- Props: `points: { bucket: string; count: number }[]`, `granularity`, `type: 'line' | 'bar'`.
- Compute min/max, scales.
- Render SVG with axes, grid lines, line/path or bars.
- Show tooltip on hover with bucket label and count.
- Keep it accessible with `role="img"` and `aria-label`.

- [ ] **Step 5: Build recent table**

`VisitsTable.tsx`:
- Props: `visits: VisitRecentItem[]`.
- Columns: time (`firstAt`), path, User-Agent (truncated).

- [ ] **Step 6: Build page**

`frontend/src/app/admin/(panel)/visits/page.tsx`:
- Server component; read search params.
- Validate/defaults:
  - `granularity` = `day` or `hour` (default `day`).
  - `from`/`to` default to last 7 days.
- Call `requireAdminPage()`.
- Fetch stats and recent in parallel.
- Render `<PageHeader>`, `<VisitsFilters>`, `<VisitsChart>`, `<VisitsTable>`.

- [ ] **Step 7: Add copy**

Load `.claude/skills/site-texts/SKILL.md` and add keys under `admin.visits.*` and `admin.nav.items.visits` in both `ru.json` and `en.json`.

- [ ] **Step 8: Verify**

Run: `cd frontend && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add frontend/src shared/messages
git commit -m "feat(admin): visits page with chart and filters"
```

---

## Task 7: Dashboard visits widget

**Files:**
- Modify: `frontend/src/lib/admin/queries/dashboard.ts`
- Modify: `frontend/src/app/admin/(panel)/page.tsx`
- Modify: `shared/messages/admin/ru.json`, `en.json`

**Interfaces:**
- Consumes: `DashboardResponse.visits`.
- Produces: dashboard shows today/yesterday counts and a link to `/admin/visits`.

- [ ] **Step 1: Update dashboard query return type**

Add `visits: { today: number; yesterday: number }` to `DashboardData`.

- [ ] **Step 2: Add widget to dashboard page**

Add a new 2-column card in the leads-summary section (or a new section) showing:
- «Визиты сегодня» → count.
- «Вчера» → count.
- Link to `/admin/visits`.

- [ ] **Step 3: Add copy**

Keys under `admin.dashboard.visitsToday`, `admin.dashboard.visitsYesterday`, `admin.dashboard.allVisits`.

- [ ] **Step 4: Verify**

Run: `cd frontend && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src shared/messages
git commit -m "feat(admin): visits widget on dashboard"
```

---

## Task 8: Prisma migration and final verification

**Files:**
- Create: `backend/prisma/migrations/2026XXXXXX_add_visits/migration.sql`

- [ ] **Step 1: Generate migration**

Run: `cd backend && npm run prisma:migration -- --name add_visits`
Expected: migration file created.

- [ ] **Step 2: Apply migration locally**

Run: `cd backend && npm run prisma:deploy:test`
Expected: applied.

- [ ] **Step 3: Run full backend test suite**

Run: `cd backend && npm run test`
Expected: PASS.

- [ ] **Step 4: Run full frontend checks**

Run: `cd frontend && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/migrations
git commit -m "chore(db): add visits migration"
```

---

## Self-review checklist

- [x] Spec coverage: tracking, admin endpoints, dashboard widget, frontend page/chart/filters, migration, tests.
- [x] Each step has one clear action and a verification command.
- [x] Type names are consistent across tasks (`VisitsStatsResponse`, `VisitGranularity`, etc.).
- [x] Review Focus items map to tests: Task 2 unit test (1, 2, 4), Task 3 E2E (2, 4), Task 1/2 covers IP hashing (3), Task 2 covers non-blocking tracking (5).
- [x] No new runtime dependencies.
