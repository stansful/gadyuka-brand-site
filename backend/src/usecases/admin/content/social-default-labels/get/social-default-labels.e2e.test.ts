import { deepStrictEqual } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import type { AdminSocialDefaultLabelsResponse } from '~shared/contracts/content-entities';

import { Locale } from '~core/locales/locale.enum';
import { MessageCatalog } from '~module/messages';
import { SiteMessagesService } from '~module/site-messages';
import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';

import { SOCIAL_DEFAULT_LABELS_ROUTE } from './social-default-labels.route';

describe('[e2e] GET /api/v1/admin/social-links/default-labels', () => {
  const EDITED_KEY = 'social.WEBSITE';
  let app: TestApp;
  let admin: TestAdmin;
  let accessToken: string;

  before(async () => {
    app = await TestApp.start();
    admin = await TestAdmin.create(app.database);
    accessToken = await admin.signIn(app.api);
  });

  after(async () => {
    await app.database.client.message.deleteMany({ where: { key: EDITED_KEY } });
    app.get(SiteMessagesService).invalidate();
    await admin.remove();
    await app.stop();
  });

  function labels() {
    return app.api.get<AdminSocialDefaultLabelsResponse>(SOCIAL_DEFAULT_LABELS_ROUTE, { accessToken });
  }

  it('answers the default name of every social type in every locale', async () => {
    const catalog = app.get(MessageCatalog);
    const response = await labels();
    deepStrictEqual(Object.keys(response.body.labels), [
      'TELEGRAM',
      'VK',
      'INSTAGRAM',
      'WHATSAPP',
      'YOUTUBE',
      'TIKTOK',
      'PINTEREST',
      'WEBSITE',
      'OTHER',
    ]);
    deepStrictEqual(response.body.labels.OTHER, {
      ru: catalog.siteDefault('social.OTHER', Locale.RU),
      en: catalog.siteDefault('social.OTHER', Locale.EN),
    });
  });

  it('shows the names edited in «Тексты сайта» (a blank translation falls back to Russian)', async () => {
    await app.database.client.message.createMany({
      data: [
        { key: EDITED_KEY, locale: 'ru', value: 'Магазин', editedAt: new Date() },
        { key: EDITED_KEY, locale: 'en', value: ' ', editedAt: new Date() },
      ],
    });
    app.get(SiteMessagesService).invalidate();
    deepStrictEqual((await labels()).body.labels.WEBSITE, { ru: 'Магазин', en: 'Магазин' });
  });
});
