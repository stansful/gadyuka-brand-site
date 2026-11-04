# Server metrics in admin panel

## Intent
Add a "Server" page to the admin panel that shows real host hardware metrics: CPU usage/load, RAM usage and disk usage. The backend runs in a hardened Docker container, so host metrics are collected by a separate privileged sidecar (`prom/node-exporter`) and consumed by the backend over the internal Docker network.

## Why now
The project runs on a single VPS; the owner wants to see the state of the machine (CPU/RAM/disk) without logging into the server via SSH, and without giving the backend container extra privileges.

## Goals
- A new admin page `/admin/server-metrics` showing CPU, RAM and disk usage.
- Metrics reflect the **host**, not only the backend container.
- The backend container keeps its existing hardening (`cap_drop: ALL`, non-root `node`, no host mounts).
- Auto-refresh every 5 seconds on the admin page.
- Graceful fallback when `node-exporter` is unavailable (local dev, tests).

## Non-goals
- Historical data / graphs (only current values).
- Alerts or thresholds.
- Monitoring of individual processes or containers.
- Exposing metrics publicly.

## Anti-goals
- Mounting host `/proc`, `/sys` or root FS into the backend container.
- Running the backend privileged or with extra capabilities.
- Adding heavy monitoring infrastructure (Prometheus server, Grafana, DB storage).

## Constraints
- Backend: NestJS 12, Node adapter, runs as unprivileged `node` in Alpine.
- Frontend: Next.js 16, React 19, Tailwind v4, server-first admin data fetching.
- Internal API key + admin role required for every admin endpoint.
- Route-access test will enforce `@Roles([UserRole.ADMIN])` on the new endpoint.
- `node-exporter` must live on the internal Docker network and be reachable only by the backend.

## Chosen approach
**A — Backend aggregates node-exporter metrics into JSON; frontend polls every 5 s.**

The backend queries `http://node-exporter:9100/metrics`, parses the Prometheus text format, extracts the values we need and returns a typed JSON response. The frontend renders an SSR page with the initial values and refreshes them client-side every 5 seconds.

### Why A
- Stable typed contract between backend and frontend.
- Frontend stays simple; no Prometheus parsing in the browser.
- Easy to unit-test the aggregation logic with sample exporter output.
- Keeps the backend free of host privileges.

## Design

### Sidecar service
Add to `docker-compose.yml`:

```yaml
  node-exporter:
    image: prom/node-exporter:v1.9.1
    restart: unless-stopped
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--path.rootfs=/rootfs'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc|rootfs/proc|rootfs/sys)($$|/)'
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    networks:
      - data
    <<: *logging
```

The service joins only the internal `data` network (no published ports), so it is reachable only from services on that network (backend, postgres, minio). No capability changes are needed for `node-exporter` itself because the read-only mounts are sufficient for metric collection.

### Backend endpoint
- **Route:** `GET /api/v1/admin/server-metrics`
- **File layout:**
  - `backend/src/usecases/admin/server-metrics/get/server-metrics.controller.ts`
  - `backend/src/usecases/admin/server-metrics/get/server-metrics.usecase.ts`
  - `backend/src/usecases/admin/server-metrics/get/server-metrics.repository.ts`
  - `backend/src/usecases/admin/server-metrics/get/server-metrics.response.ts`
  - `backend/src/usecases/admin/server-metrics/get/server-metrics.route.ts`
  - `backend/src/usecases/admin/server-metrics/server-metrics.module.ts`
- The controller uses `@ApiBearerAuth()` and `@Roles([UserRole.ADMIN])`.
- The usecase calls a repository that fetches `http://node-exporter:9100/metrics`.
- If the exporter is unreachable (status !== 200), the repository falls back to container-local metrics using `node:os` and `node:fs`. This keeps local dev and tests working without the sidecar.

### Response contract
`shared/contracts/server-metrics.ts`:

```ts
export interface ServerMetricsResponse {
  readonly cpu: {
    readonly usagePercent: number | null;
    readonly loadAverage1m: number;
    readonly cores: number;
  };
  readonly memory: {
    readonly totalBytes: number;
    readonly usedBytes: number;
    readonly usedPercent: number;
  };
  readonly disks: readonly {
    readonly device: string;
    readonly mountpoint: string;
    readonly totalBytes: number;
    readonly usedBytes: number;
    readonly usedPercent: number;
  }[];
  readonly uptimeSeconds: number;
  readonly timestamp: string;
}
```

#### CPU usage calculation
CPU usage is computed from `node_cpu_seconds_total` counters:
- On each request, fetch current CPU counters.
- Keep the previous sample in an in-memory cache (last 10 seconds).
- `usagePercent = 100 * (1 - delta_idle / delta_total)`.
- If no previous sample exists, return `null` for `usagePercent` (the next poll will have a delta).

`loadAverage1m` comes from `node_load1`. `cores` comes from the count of `node_cpu_seconds_total{mode="idle"}` series.

#### Memory
- `totalBytes` = `node_memory_MemTotal_bytes`
- `usedBytes` = `totalBytes - node_memory_MemAvailable_bytes`
- `usedPercent` = `usedBytes / totalBytes * 100`

#### Disks
Use `node_filesystem_size_bytes` and `node_filesystem_avail_bytes` filtered to real filesystems (`fstype!~"^(proc|sysfs|tmpfs|devtmpfs|overlay|squashfs)$"`).
- `totalBytes` = `size`
- `usedBytes` = `size - avail`
- `usedPercent` = `usedBytes / totalBytes * 100`

### Frontend
- **Page:** `frontend/src/app/admin/(panel)/server-metrics/page.tsx`
- **Query:** `frontend/src/lib/admin/queries/server-metrics.ts`
- **Nav item:** add `{ href: '/admin/server-metrics', key: 'serverMetrics', icon: Activity }` in `AdminSidebar.tsx`.
- **Translations:** `shared/messages/admin/ru.json` keys under `admin.serverMetrics.*` and `admin.nav.items.serverMetrics`.
- **UI:** reuse `Card` and `PageHeader` from `frontend/src/components/admin/ui/layout.tsx`. Add a small `ProgressBar` component (orange/beige fill on dark background, matching the screenshot).
- **Client refresh:** a small hook/component fetches `/api/v1/admin/server-metrics` every 5 s and updates the displayed values. During SSR the page shows the first server-fetched snapshot.

### Security
- The new endpoint is admin-only and requires `x-internal-key` + bearer token, like all admin endpoints.
- `node-exporter` is not exposed to the proxy or the internet; it lives only on the internal `data` network.
- The backend never mounts host paths; it only makes outbound HTTP to the sidecar.

### Fallback
When `node-exporter` is unavailable:
- CPU: cores from `os.cpus()`, load average from `os.loadavg()[0]`, usage percent `null`.
- Memory: total/used from `os.totalmem()` / `os.freemem()`.
- Disks: `fs.statfs('/')` and `fs.statfs(process.env.LOG_DIR ?? '/var/log/gadyuka')`.
- This is enough for local development and tests.

## Verification
- `npm run gen:usecase` creates the boilerplate and tests compile.
- `npm run test:backend` (unit/e2e) passes, including route-access tests.
- `npm run build` in frontend succeeds.
- In local dev without the sidecar the page shows container-local fallback values.
- In Docker with the sidecar the page shows host CPU/RAM/disk values.

## Builder decisions left to the implementer
- Exact node-exporter image tag (suggested `v1.9.1`).
- Whether to cache the previous CPU sample in the repository or in a small helper service.
- Exact polling interval on the frontend (suggested 5 s).
- Whether to show all disks or only a filtered list (e.g. `/`, `/var/log/gadyuka`).
