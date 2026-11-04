import { deepStrictEqual, strictEqual } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import type { VisitsStatsResponse } from '~shared/contracts/visits';

import { TestClientIp } from '~test/e2e/client-ip';
import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';

import { VISITS_STATS_ROUTE } from './visits-stats.route';

describe('[e2e] GET /api/v1/admin/visits/stats', () => {
  let app: TestApp;
  let admin: TestAdmin;
  const storedIds: string[] = [];

  before(async () => {
    app = await TestApp.start();
    admin = await TestAdmin.create(app.database);
  });

  after(async () => {
    await app.database.client.visit.deleteMany({ where: { id: { in: storedIds } } });
    await admin.remove();
    await app.stop();
  });

  async function seedVisit(clientIp: string, hourBucket: Date, userAgent = 'e2e-agent', path = '/ru'): Promise<void> {
    const visit = await app.database.client.visit.create({
      data: {
        hourBucket,
        ipHash: `hash-${clientIp}`,
        userAgent,
        path,
        firstAt: hourBucket,
        lastAt: hourBucket,
      },
    });
    storedIds.push(visit.id);
  }

  async function stats(from: string, to: string, granularity: 'day' | 'hour'): Promise<VisitsStatsResponse> {
    const token = await admin.signIn(app.api);
    const query = new URLSearchParams({ from, to, granularity }).toString();
    const response = await app.api.get<VisitsStatsResponse>(`${VISITS_STATS_ROUTE}?${query}`, {
      accessToken: token,
    });
    strictEqual(response.status, 200);
    return response.body;
  }

  it('aggregates unique visitors by day and by hour', async () => {
    const ipA = TestClientIp.random();
    const ipB = TestClientIp.random();

    // IP A twice in the same hour → one row, one visitor.
    await seedVisit(ipA, new Date('2026-11-01T10:05:00.000Z'));
    await seedVisit(ipA, new Date('2026-11-01T10:45:00.000Z'));

    // IP A in the next hour → second row, still the same daily visitor.
    await seedVisit(ipA, new Date('2026-11-01T11:10:00.000Z'));

    // IP B in the first hour → one row, second daily visitor.
    await seedVisit(ipB, new Date('2026-11-01T10:20:00.000Z'));

    const byHour = await stats('2026-11-01', '2026-11-01', 'hour');
    deepStrictEqual(
      byHour.points.map(p => ({ bucket: p.bucket.slice(0, 13), count: p.count })),
      [
        { bucket: '2026-11-01T10', count: 2 },
        { bucket: '2026-11-01T11', count: 1 },
      ],
    );
    strictEqual(byHour.total, 2);

    const byDay = await stats('2026-11-01', '2026-11-01', 'day');
    deepStrictEqual(byDay.points, [{ bucket: '2026-11-01', count: 2 }]);
    strictEqual(byDay.total, 2);
  });

  it('refuses non-admin users', async () => {
    const response = await app.api.get(`${VISITS_STATS_ROUTE}?from=2026-11-01&to=2026-11-01&granularity=day`);
    strictEqual(response.status, 401);
  });
});
