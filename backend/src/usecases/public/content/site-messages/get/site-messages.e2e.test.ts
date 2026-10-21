import { deepStrictEqual, strictEqual } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import type { SiteMessagesResponse } from '~shared/contracts/content';
import type { ApiErrorResponse, ApiValidationErrorResponse } from '~shared/contracts/errors';

import { Locale } from '~core/locales/locale.enum';
import { MessageCatalog, MessagesDirectory } from '~module/messages';
import { SiteMessagesService } from '~module/site-messages';
import { TestApp } from '~test/e2e/test-app';

import { SITE_MESSAGES_ROUTE } from './site-messages.route';

describe('[e2e] GET /api/v1/public/messages/:locale', () => {
  /** Keys this file edits (none of them is read by another e2e test). */
  const KEYS = ['notFound.title', 'notFound.caption'];
  const catalog = new MessageCatalog(MessagesDirectory.locate());
  let app: TestApp;

  before(async () => {
    app = await TestApp.start();
    await removeRows();
  });

  after(async () => {
    await removeRows();
    await app.stop();
  });

  async function removeRows(): Promise<void> {
    await app.database.client.message.deleteMany({ where: { key: { in: KEYS } } });
    app.get(SiteMessagesService).invalidate();
  }

  function messagesOf(locale: string) {
    return app.api.get<SiteMessagesResponse>(SITE_MESSAGES_ROUTE.replace(':locale', locale));
  }

  function notFoundOf(response: SiteMessagesResponse): unknown {
    return response.messages.notFound;
  }

  it('answers the defaults of shared/messages as the nested tree (no rows)', async () => {
    const response = await messagesOf('en');
    strictEqual(response.status, 200);
    strictEqual(response.body.locale, 'en');
    deepStrictEqual(notFoundOf(response.body), catalog.siteTree(Locale.EN).notFound);
  });

  it('shows the admin rows over the defaults once the cache is invalidated', async () => {
    await app.database.client.message.createMany({
      data: [
        { key: 'notFound.title', locale: 'ru', value: 'Правка админа' },
        { key: 'notFound.title', locale: 'en', value: '   ' },
        { key: 'notFound.caption', locale: 'ru', value: '' },
      ],
    });
    app.get(SiteMessagesService).invalidate();
    const [ru, en] = await Promise.all([messagesOf('ru'), messagesOf('en')]);
    deepStrictEqual(
      { ruTitle: pick(ru.body, 'title'), ruCaption: pick(ru.body, 'caption'), enTitle: pick(en.body, 'title') },
      { ruTitle: 'Правка админа', ruCaption: '', enTitle: 'Правка админа' },
    );
  });

  it('refuses an unknown locale with a validation key', async () => {
    const response = await app.api.get<ApiValidationErrorResponse>(SITE_MESSAGES_ROUTE.replace(':locale', 'de'));
    strictEqual(response.status, 400);
    deepStrictEqual(response.body.fields, { locale: { key: 'admin.validation.invalid' } });
  });

  it('needs the internal key like every API route', async () => {
    const response = await app.api
      .withoutInternalKey()
      .get<ApiErrorResponse>(SITE_MESSAGES_ROUTE.replace(':locale', 'ru'));
    strictEqual(response.status, 401);
  });

  function pick(response: SiteMessagesResponse, key: string): unknown {
    const branch = response.messages.notFound;
    return typeof branch === 'object' ? branch[key] : undefined;
  }
});
