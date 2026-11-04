import { ok, strictEqual } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';

import { ServerMetricsResponse } from './server-metrics.response';
import { SERVER_METRICS_ROUTE } from './server-metrics.route';

describe('[e2e] GET /api/v1/admin/server-metrics', () => {
  let app: TestApp;
  let admin: TestAdmin;
  let accessToken: string;

  before(async () => {
    app = await TestApp.start();
    admin = await TestAdmin.create(app.database);
    accessToken = await admin.signIn(app.api);
  });

  after(async () => {
    await admin.remove();
    await app.stop();
  });

  it('answers 200 with server metrics structure', async () => {
    const response = await app.api.get<ServerMetricsResponse>(SERVER_METRICS_ROUTE, { accessToken });
    strictEqual(response.status, 200);

    const body = response.body;
    ok(typeof body.cpu.cores === 'number' && body.cpu.cores >= 1);
    ok(typeof body.cpu.loadAverage1m === 'number' && body.cpu.loadAverage1m >= 0);
    ok(body.cpu.usagePercent === null || (body.cpu.usagePercent >= 0 && body.cpu.usagePercent <= 100));

    ok(body.memory.totalBytes > 0);
    ok(body.memory.usedBytes >= 0 && body.memory.usedBytes <= body.memory.totalBytes);
    ok(body.memory.usedPercent >= 0 && body.memory.usedPercent <= 100);

    ok(Array.isArray(body.disks));
    for (const disk of body.disks) {
      ok(typeof disk.device === 'string');
      ok(typeof disk.mountpoint === 'string');
      ok(disk.totalBytes > 0);
      ok(disk.usedBytes >= 0 && disk.usedBytes <= disk.totalBytes);
      ok(disk.usedPercent >= 0 && disk.usedPercent <= 100);
    }

    ok(typeof body.uptimeSeconds === 'number' && body.uptimeSeconds >= 0);
    ok(typeof body.timestamp === 'string');
  });
});
