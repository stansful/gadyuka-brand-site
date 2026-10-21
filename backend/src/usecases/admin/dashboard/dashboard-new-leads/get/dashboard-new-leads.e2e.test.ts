import { strictEqual } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import type { DashboardNewLeadsResponse } from '~shared/contracts/dashboard';

import { LeadStatus } from '~core/leads/lead-status';
import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { DashboardFixtures } from '~usecases/admin/dashboard/test/dashboard-fixtures';
import { RetriedProbe } from '~usecases/admin/dashboard/test/retried-probe';

import { DASHBOARD_NEW_LEADS_ROUTE } from './dashboard-new-leads.route';

describe('[e2e] GET /api/v1/admin/dashboard/new-leads', () => {
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

  async function newLeads(): Promise<number> {
    const response = await app.api.get<DashboardNewLeadsResponse>(DASHBOARD_NEW_LEADS_ROUTE, { accessToken });
    strictEqual(response.status, 200);
    return response.body.count;
  }

  /** How many more NEW leads the badge shows after two new leads and one in progress (removed again). */
  async function measureNewLeads(): Promise<number> {
    const before = await newLeads();
    const fixtures = new DashboardFixtures(app.database);
    await fixtures.createLead({ status: LeadStatus.NEW, telegramSent: false });
    await fixtures.createLead({ status: LeadStatus.NEW, telegramSent: true });
    await fixtures.createLead({ status: LeadStatus.IN_PROGRESS, telegramSent: false });
    const after = await newLeads();
    await fixtures.remove();
    return after - before;
  }

  it('counts the leads with status NEW (the badge of the sidebar)', async () => {
    strictEqual(await RetriedProbe.until(measureNewLeads, value => value === 2), 2);
  });
});
