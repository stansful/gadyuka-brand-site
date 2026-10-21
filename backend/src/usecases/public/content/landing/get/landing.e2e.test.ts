import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import type { LandingResponse, PublicSettingsResponse } from '~shared/contracts/content';
import type { ApiErrorResponse, ApiValidationErrorResponse } from '~shared/contracts/errors';

import { SiteMessagesService } from '~module/site-messages';
import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { PublicContentFixtures } from '~usecases/public/content/common/test/public-content-fixtures';
import { PUBLIC_SETTINGS_ROUTE } from '~usecases/public/content/public-settings/get/public-settings.route';

import { LANDING_ROUTE } from './landing.route';

/**
 * Rows of this file get orders far below anything else in a shared test database, so every bounded
 * list of the landing starts with them; assertions look at these rows only.
 */
const FIRST = -1_000_000;
const MINUTE_MS = 60_000;

describe('[e2e] GET /api/v1/public/landing/:locale', () => {
  let app: TestApp;
  let owner: TestAdmin;
  let fixtures: PublicContentFixtures;

  before(async () => {
    app = await TestApp.start();
    owner = await TestAdmin.create(app.database);
    fixtures = new PublicContentFixtures(app.database, owner.id);
  });

  after(async () => {
    await fixtures.remove();
    await owner.remove();
    app.get(SiteMessagesService).invalidate();
    await app.stop();
  });

  function landingOf(locale: string) {
    return app.api.get<LandingResponse>(LANDING_ROUTE.replace(':locale', locale));
  }

  function only<T extends { id: string }>(rows: readonly T[], ids: readonly string[]): T[] {
    return rows.filter(row => ids.includes(row.id));
  }

  it('lists the published collections with their published products, ordered and localized', async () => {
    const cover = await fixtures.createMedia({ alt: { ru: 'Обложка' } });
    const photo = await fixtures.createMedia({ alt: { ru: 'Фото', en: 'Photo' } });
    const collection = await fixtures.createCollection({
      title: { ru: 'Нуар', en: 'Noir' },
      description: { ru: 'Описание' },
      coverId: cover,
      order: FIRST,
      published: true,
    });
    const second = await fixtures.createProduct(collection, { order: 2, published: true, price: 9900 });
    const first = await fixtures.createProduct(collection, {
      order: 1,
      published: true,
      title: { ru: 'Пальто', en: 'Coat' },
      details: { ru: 'шерсть\n\n оверсайз ', en: 'wool\r\noversize' },
    });
    await fixtures.createProduct(collection, { order: 0, published: false });
    await fixtures.createProductImage(first, photo, 0);

    const hidden = await fixtures.createCollection({ order: FIRST - 1, published: false });

    const response = await landingOf('en');
    strictEqual(response.status, 200);
    strictEqual(only(response.body.collections, [hidden]).length, 0, 'a hidden collection is not listed');
    const [view] = only(response.body.collections, [collection]);
    deepStrictEqual(
      {
        title: view?.title,
        description: view?.description,
        coverAlt: view?.cover?.alt,
        coverAltDefault: view?.cover?.altDefault,
      },
      { title: 'Noir', description: 'Описание', coverAlt: '', coverAltDefault: 'Обложка' },
    );
    deepStrictEqual(
      view?.products.map(product => product.id),
      [first, second],
    );
    const coat = view?.products[0];
    deepStrictEqual(
      { title: coat?.title, details: coat?.details, price: coat?.price, images: coat?.images.map(image => image.alt) },
      { title: 'Coat', details: ['wool', 'oversize'], price: null, images: ['Photo'] },
    );
  });

  it('shows at most 48 products of a collection', async () => {
    const collection = await fixtures.createCollection({ order: FIRST - 1, published: true });
    for (let order = 0; order < 49; order += 1) {
      await fixtures.createProduct(collection, { order, published: true });
    }
    const response = await landingOf('ru');
    const view = response.body.collections.find(row => row.id === collection);
    strictEqual(view?.products.length, 48);
  });

  it('orders reviews by the admin order, the newer first on ties, without hidden ones', async () => {
    const older = await fixtures.createReview({
      order: FIRST,
      published: true,
      rating: 1,
      createdAt: new Date(2026, 0, 1),
    });
    const newer = await fixtures.createReview({
      order: FIRST,
      published: true,
      rating: null,
      role: { ru: 'покупатель' },
      text: { ru: 'Отлично', en: 'Great' },
      createdAt: new Date(2026, 0, 2),
    });
    const hidden = await fixtures.createReview({ order: FIRST, published: false });

    const response = await landingOf('en');
    const reviews = only(response.body.reviews, [older, newer, hidden]);
    deepStrictEqual(
      reviews.map(review => [review.id, review.rating]),
      [
        [newer, null],
        [older, 1],
      ],
    );
    deepStrictEqual([reviews[0]?.role, reviews[0]?.text], ['покупатель', 'Great']);
  });

  it('keeps every review rating on the star scale of the settings', async () => {
    const response = await landingOf('ru');
    const max = response.body.settings.reviewRatingMax;
    ok(response.body.reviews.every(review => review.rating === null || (review.rating >= 1 && review.rating <= max)));
  });

  it('lists the newest news first, without hidden ones', async () => {
    const date = (day: number): Date => new Date(Date.UTC(2099, 0, day));
    const old = await fixtures.createNews({ published: true, date: date(1) });
    const latest = await fixtures.createNews({ published: true, date: date(3), excerpt: { ru: 'Кратко' } });
    const hidden = await fixtures.createNews({ published: false, date: date(5) });

    const response = await landingOf('en');
    const news = only(response.body.news, [old, latest, hidden]);
    deepStrictEqual(
      news.map(item => [item.id, item.date, item.excerpt]),
      [
        [latest, date(3).toISOString(), 'Кратко'],
        [old, date(1).toISOString(), ''],
      ],
    );
  });

  it('lists the offers that have not ended and hints the earliest end', async () => {
    const now = Date.now();
    const ended = await fixtures.createOffer({ order: FIRST, published: true, validUntil: new Date(now - MINUTE_MS) });
    const soon = new Date(now + 10 * MINUTE_MS);
    const ending = await fixtures.createOffer({
      order: FIRST + 1,
      published: true,
      validUntil: soon,
      ctaHref: '#contacts',
    });
    const open = await fixtures.createOffer({ order: FIRST + 2, published: true, badge: { ru: '−15%' } });
    const hidden = await fixtures.createOffer({ order: FIRST, published: false });

    const response = await landingOf('en');
    const offers = only(response.body.offers, [ended, ending, open, hidden]);
    deepStrictEqual(
      offers.map(offer => [offer.id, offer.validUntil, offer.badge, offer.ctaHref]),
      [
        [ending, soon.toISOString(), '', '#contacts'],
        [open, null, '−15%', null],
      ],
    );
    ok(response.body.offersExpireAt !== null && Date.parse(response.body.offersExpireAt) <= soon.getTime());
  });

  it('lists the gallery, the partners, the menu and the social links (published, ordered, localized)', async () => {
    const picture = await fixtures.createMedia({ alt: { ru: 'Съёмка' } });
    const gallery = await fixtures.createGalleryItem(picture, {
      order: FIRST,
      published: true,
      caption: { ru: 'Подпись' },
    });
    const partner = await fixtures.createPartner({
      order: FIRST,
      published: true,
      url: 'https://example.com',
      logoId: picture,
    });
    const unlabeled = await fixtures.createMenuItem({ order: FIRST, label: {} });
    const menu = await fixtures.createMenuItem({
      order: FIRST + 1,
      label: { ru: 'О нас', en: 'About' },
      showInFooter: false,
    });
    const hiddenMenu = await fixtures.createMenuItem({ order: FIRST, published: false });
    const social = await fixtures.createSocialLink({ order: FIRST, label: {} });
    const labeled = await fixtures.createSocialLink({ order: FIRST + 1, type: 'VK', label: { ru: 'Группа' } });

    const { body } = await landingOf('en');
    deepStrictEqual(
      only(body.gallery, [gallery]).map(item => [item.caption, item.image.altDefault]),
      [['Подпись', 'Съёмка']],
    );
    deepStrictEqual(
      only(body.partners, [partner]).map(item => [item.url, item.logo?.id]),
      [['https://example.com', picture]],
    );
    deepStrictEqual(only(body.menu, [unlabeled, menu, hiddenMenu]), [
      { id: menu, label: 'About', href: '#catalog', showInHeader: true, showInFooter: false },
    ]);
    deepStrictEqual(
      only(body.socials, [social, labeled]).map(link => [link.type, link.label]),
      [
        ['TELEGRAM', null],
        ['VK', 'Группа'],
      ],
    );
  });

  it('keys the landing images by ContentImage key (null for a slot without media)', async () => {
    const media = await fixtures.createMedia({ alt: { ru: 'Ателье', en: 'Studio' } });
    const filled = await fixtures.createContentImage(media);
    const empty = await fixtures.createContentImage(null);

    const { body } = await landingOf('en');
    deepStrictEqual([body.images[filled]?.id, body.images[filled]?.alt], [media, 'Studio']);
    strictEqual(body.images[empty], null);
  });

  it('shows the admin edits of the site messages in texts (the same values as /public/messages)', async () => {
    await fixtures.saveMessage('notFound.kicker', 'ru', 'Тупик (e2e)');
    app.get(SiteMessagesService).invalidate();
    const [ru, en] = await Promise.all([landingOf('ru'), landingOf('en')]);
    strictEqual(ru.body.texts['notFound.kicker'], 'Тупик (e2e)');
    strictEqual(typeof en.body.texts['hero.title'], 'string');
    strictEqual(ru.body.locale, 'ru');
  });

  it('answers the same settings as GET /public/settings/:locale', async () => {
    const [landing, settings] = await Promise.all([
      landingOf('en'),
      app.api.get<PublicSettingsResponse>(PUBLIC_SETTINGS_ROUTE.replace(':locale', 'en')),
    ]);
    deepStrictEqual(landing.body.settings, settings.body.settings);
  });

  it('refuses an unknown locale with a validation key', async () => {
    const response = await app.api.get<ApiValidationErrorResponse>(LANDING_ROUTE.replace(':locale', 'de'));
    strictEqual(response.status, 400);
    deepStrictEqual(response.body.fields, { locale: { key: 'admin.validation.invalid' } });
  });

  it('needs the internal key like every API route', async () => {
    const response = await app.api.withoutInternalKey().get<ApiErrorResponse>(LANDING_ROUTE.replace(':locale', 'ru'));
    strictEqual(response.status, 401);
  });
});
