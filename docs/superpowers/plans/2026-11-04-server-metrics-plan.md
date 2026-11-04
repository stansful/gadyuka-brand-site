# Plan: server metrics in admin panel

Branch: `feature/server-metrics`
Worktree: `/Users/stansful/projects/my/zenya-brand/.worktrees/feature-server-metrics`

## 1. Add node-exporter sidecar to Docker Compose
**File:** `docker-compose.yml`

Add a `node-exporter` service in the internal `data` network, mounting host `/proc`, `/sys` and `/` read-only. Use `prom/node-exporter:v1.9.1`.

## 2. Backend endpoint

### 2.1 Shared contract
**File:** `shared/contracts/server-metrics.ts`

Define `ServerMetricsResponse` interface.

### 2.2 Re-export
**File:** `shared/contracts/index.ts`

Add export for the new contract.

### 2.3 Usecase boilerplate
Generate with:

```bash
cd backend && npm run gen:usecase -- --group admin --slice server-metrics --feature server-metrics --method get
```

This creates:
- `backend/src/usecases/admin/server-metrics/server-metrics/get/server-metrics.controller.ts`
- `.../server-metrics.usecase.ts`
- `.../server-metrics.repository.ts`
- `.../server-metrics.response.ts`
- `.../server-metrics.route.ts`

### 2.4 Customize generated files
- Move/rename if generator creates nested `server-metrics/server-metrics`; flatten to `backend/src/usecases/admin/server-metrics/get/`.
- Controller: add `@ApiBearerAuth()` and `@Roles([UserRole.ADMIN])`.
- Route: `SERVER_METRICS_ROUTE = `${API_VERSION}/admin/server-metrics``.
- Response class: map to `ServerMetricsResponse` from shared contracts.
- Repository:
  - Fetch `http://node-exporter:9100/metrics`.
  - Parse Prometheus text format.
  - Compute CPU usage from two consecutive samples (in-memory cache).
  - Compute memory and disk metrics.
  - Fallback to `node:os`/`node:fs` when exporter is unreachable.
- Usecase: wire repository and return response.

### 2.5 Register module
**File:** `backend/src/usecases/admin/admin.module.ts`

Import `ServerMetricsModule`.

### 2.6 Tests
- Add unit test for repository parsing/aggregation with sample exporter output.
- Ensure route-access test passes (endpoint has admin role).

## 3. Frontend page

### 3.1 Query helper
**File:** `frontend/src/lib/admin/queries/server-metrics.ts`

Server-only helper calling `readAdminData<ServerMetricsResponse>(SERVER_METRICS_PATH)` after `requireAdminPage()`.

### 3.2 Page
**File:** `frontend/src/app/admin/(panel)/server-metrics/page.tsx`

- Server-render initial metrics.
- Use `PageHeader` and `Card` components.
- Render CPU, memory and disk cards with progress bars.
- Add a client component that polls the API every 5 seconds.

### 3.3 Progress bar component
**File:** `frontend/src/components/admin/ui/ProgressBar.tsx`

Simple progress bar using Tailwind colors from `admin.css`.

### 3.4 Navigation
**File:** `frontend/src/components/admin/layout/AdminSidebar.tsx`

Add `{ href: '/admin/server-metrics', key: 'serverMetrics', icon: Activity }`.

## 4. Translations
**File:** `shared/messages/admin/ru.json`

Add:
- `admin.nav.items.serverMetrics`
- `admin.serverMetrics.title`
- `admin.serverMetrics.description`
- `admin.serverMetrics.cpu`
- `admin.serverMetrics.memory`
- `admin.serverMetrics.disk`
- `admin.serverMetrics.loadAverage`
- `admin.serverMetrics.cores`
- `admin.serverMetrics.uptime`
- `admin.serverMetrics.refreshing`

## 5. Verification

Run in worktree:

```bash
cd backend && npm run build && npm run test:backend
cd ../frontend && npm run build
```

Manual checks:
- Admin sidebar shows "Server" item.
- `/admin/server-metrics` renders without errors.
- Without sidecar: page shows fallback container metrics.
- With sidecar in Docker: page shows host metrics.

## Order of edits
1. `docker-compose.yml`
2. `shared/contracts/server-metrics.ts`
3. `shared/contracts/index.ts`
4. Generate backend usecase and customize files.
5. `backend/src/usecases/admin/admin.module.ts`
6. Backend tests.
7. `frontend/src/lib/admin/queries/server-metrics.ts`
8. `frontend/src/components/admin/ui/ProgressBar.tsx`
9. `frontend/src/app/admin/(panel)/server-metrics/page.tsx`
10. `frontend/src/components/admin/layout/AdminSidebar.tsx`
11. `shared/messages/admin/ru.json`
12. Build & test both packages.
