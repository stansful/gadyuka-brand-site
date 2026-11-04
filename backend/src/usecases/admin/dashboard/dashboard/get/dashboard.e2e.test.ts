import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import type { DashboardResponse } from '~shared/contracts/dashboard';
import type { SiteTextsPageResponse } from '~shared/contracts/site-texts';

import { LeadStatus } from '~core/leads/lead-status';
import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { DashboardFixtures } from '~usecases/admin/dashboard/test/dashboard-fixtures';
import { RetriedProbe } from '~usecases/admin/dashboard/test/retried-probe';
import { SITE_TEXTS_PAGE_ROUTE } from '~usecases/admin/site-texts/site-texts-page/get/site-texts-page.route';

import { DASHBOARD_ROUTE } from './dashboard.route';

describe('[e2e] GET /api/v1/admin/dashboard', () => {
  const COUNTED_LISTS = ['collection', 'menuItem', 'socialLink', 'news'] as const;
  type CountedList = (typeof COUNTED_LISTS)[number];
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

  async function dashboard(): Promise<DashboardResponse> {
    const response = await app.api.get<DashboardResponse>(DASHBOARD_ROUTE, { accessToken });
    strictEqual(response.status, 200);
    return response.body;
  }

  /** What the dashboard counts more after creating a known set of rows (removed again). */
  async function measureCreatedRows(): Promise<Record<string, unknown>> {
    const before = await dashboard();
    const fixtures = new DashboardFixtures(app.database);
    await createKnownRows(fixtures);
    const after = await dashboard();
    await fixtures.remove();
    return differenceOf(before, after);
  }

  /** 2 collections (1 on the site), 1 hidden menu item, 2 social links (1 on the site), 1 media, 3 leads. */
  async function createKnownRows(fixtures: DashboardFixtures): Promise<void> {
    await fixtures.createCollections();
    await fixtures.createMenuItem();
    await fixtures.createSocialLinks();
    await fixtures.createMedia(admin.id);
    await fixtures.createLead({ status: LeadStatus.NEW, telegramSent: false });
    await fixtures.createLead({ status: LeadStatus.SPAM, telegramSent: false });
    await fixtures.createLead({ status: LeadStatus.DONE, telegramSent: true });
  }

  function differenceOf(before: DashboardResponse, after: DashboardResponse): Record<string, unknown> {
    const minus = (key: CountedList) => ({
      total: after.entities[key].total - before.entities[key].total,
      published: after.entities[key].published - before.entities[key].published,
    });
    const leads = (key: keyof DashboardResponse['leads']) => after.leads[key] - before.leads[key];
    const lists = Object.fromEntries(COUNTED_LISTS.map(key => [key, minus(key)]));
    const counted = { total: leads('total'), fresh: leads('fresh'), telegramFailed: leads('telegramFailed') };
    return { ...lists, media: after.media - before.media, leads: counted };
  }

  it('counts every list (total / on the site), the media and the leads (new, not delivered — spam aside)', async () => {
    const expected = {
      collection: { total: 2, published: 1 },
      menuItem: { total: 1, published: 0 },
      socialLink: { total: 2, published: 1 },
      news: { total: 0, published: 0 },
      media: 1,
      leads: { total: 3, fresh: 1, telegramFailed: 1 },
    };
    const difference = await RetriedProbe.until(
      measureCreatedRows,
      value => JSON.stringify(value) === JSON.stringify(expected),
    );
    deepStrictEqual(difference, expected);
    const body = await dashboard();
    deepStrictEqual(Object.keys(body.entities).sort(), [
      'collection',
      'gallery',
      'menuItem',
      'news',
      'offer',
      'partner',
      'product',
      'review',
      'socialLink',
    ]);
  });

  it('lists the newest leads first, with a one-line preview of the message', async () => {
    const fixtures = new DashboardFixtures(app.database);
    const message = `  Длинное\n\n сообщение  ${'я'.repeat(200)}`;
    const createdAt = new Date('2999-01-01T00:00:00.000Z');
    const id = await fixtures.createLead({ status: LeadStatus.NEW, telegramSent: false, message, createdAt });
    try {
      const { latestLeads } = await dashboard();
      ok(latestLeads.length <= 5);
      const preview = `Длинное сообщение ${'я'.repeat(200)}`.slice(0, 140);
      deepStrictEqual(latestLeads[0], {
        id,
        type: 'CONTACT',
        status: 'NEW',
        name: latestLeads[0]?.name,
        email: 'e2e@example.com',
        phone: null,
        preview: `${preview}…`,
        locale: 'ru',
        telegramSent: false,
        createdAt: createdAt.toISOString(),
      });
    } finally {
      await fixtures.remove();
    }
  });

  it('counts unique visits for today and yesterday', async () => {
    await app.database.client.visit.deleteMany({});
    const today = new Date();
    today.setUTCHours(12, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    const [todayVisit, yesterdayVisit] = await Promise.all([
      app.database.client.visit.create({
        data: {
          hourBucket: today,
          ipHash: 'today-hash',
          firstAt: today,
          lastAt: today,
        },
      }),
      app.database.client.visit.create({
        data: {
          hourBucket: yesterday,
          ipHash: 'yesterday-hash',
          firstAt: yesterday,
          lastAt: yesterday,
        },
      }),
    ]);
    try {
      const { visits } = await dashboard();
      strictEqual(visits.today, 1);
      strictEqual(visits.yesterday, 1);
    } finally {
      await app.database.client.visit.deleteMany({
        where: { id: { in: [todayVisit.id, yesterdayVisit.id] } },
      });
    }
  });

  it('counts the site texts like the tabs of «Тексты сайта»', async () => {
    const compare = async () => {
      const [{ texts }, page] = await Promise.all([
        dashboard(),
        app.api.get<SiteTextsPageResponse>(SITE_TEXTS_PAGE_ROUTE, { accessToken }),
      ]);
      const sum = (field: 'total' | 'edited' | 'gaps' | 'unsaved') =>
        page.body.sections.reduce((total, section) => total + section[field], 0);
      return {
        texts,
        tabs: { total: sum('total'), edited: sum('edited'), gaps: sum('gaps'), unsaved: sum('unsaved') },
      };
    };
    const { texts, tabs } = await RetriedProbe.until(
      compare,
      value => JSON.stringify(value.texts) === JSON.stringify(value.tabs),
    );
    deepStrictEqual(texts, tabs);
    ok(texts.total > 100);
  });
});
