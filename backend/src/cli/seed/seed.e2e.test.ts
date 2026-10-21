import { deepStrictEqual, match, notStrictEqual, ok, strictEqual } from 'node:assert';
import { basename } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { isDeepStrictEqual } from 'node:util';

import { LocaleMap } from '~core/locales/locale-map';
import { Locale } from '~core/locales/locale.enum';
import { MEDIA_MIME } from '~core/media/media.constants';
import { SocialType } from '~core/socials/social-type';
import { MessageCatalog, MessagesDirectory } from '~module/messages';

import { SeedCopyLoader } from './copy/seed-copy.loader';
import { DemoEntityCatalog } from './data/demo-entity.catalog';
import { SEED_MEDIA_KEYS, SeedMediaKey } from './data/seed-media-key.enum';
import { SEED_MEDIA_SOURCES } from './data/seed-media.sources';
import { SeedRowIds } from './data/seed-row-ids';
import { SeedAssets } from './media/seed-assets';
import { SeedMediaIdentity } from './media/seed-media.identity';
import { SeedMode } from './run/seed-mode.enum';
import { SeedTestHarness } from './test/seed-test-harness';
import { SeedTestSnapshot } from './test/seed-test-snapshot';

const messages = new MessageCatalog(MessagesDirectory.locate());
const catalog = new DemoEntityCatalog(new SeedCopyLoader(MessagesDirectory.locate()).load(), new SeedRowIds());
const rowIds = new SeedRowIds();
const identity = new SeedMediaIdentity();
const ABOUT_IMAGE = 'about.image';
const TAILORING_IMAGE = 'tailoring.image';
const SEED_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** SeedAssets that serve another photo for one image (an asset edited since the last seed). */
class EditedAssets extends SeedAssets {
  constructor(
    private readonly edited: SeedMediaKey,
    private readonly replacement: SeedMediaKey,
  ) {
    super();
  }

  override read(source: string): Promise<Buffer> {
    const replaced = source === SEED_MEDIA_SOURCES[this.edited] ? SEED_MEDIA_SOURCES[this.replacement] : source;
    return super.read(replaced);
  }
}

describe('[e2e] npm run db:seed (src/cli/seed)', () => {
  let harness: SeedTestHarness;

  before(async () => {
    harness = await SeedTestHarness.start();
  });

  after(async () => {
    await harness.stop();
  });

  /** Media.id of every seed image, by the file name of its source (unique among the seed images). */
  async function mediaIdsByKey(): Promise<Record<SeedMediaKey, string>> {
    const rows = await harness.client.media.findMany({
      where: { ownerId: harness.ownerId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, originalName: true },
    });
    const idByName = new Map(rows.map(row => [row.originalName, row.id]));
    const entries = SEED_MEDIA_KEYS.map(key => [key, idByName.get(basename(SEED_MEDIA_SOURCES[key])) ?? 'missing']);
    // Every seed key is an entry above.
    return Object.fromEntries(entries) as Record<SeedMediaKey, string>;
  }

  async function objectStamp(key: string): Promise<string> {
    const file = await harness.disk.stat(key);
    return `${file.etag ?? ''}|${file.lastModified.toISOString()}|${file.size}`;
  }

  it('first run: messages, media with alt texts, content images and every demo entity', async () => {
    await harness.seed(SeedMode.KEEP_EDITS);
    const { client } = harness;

    strictEqual(await client.message.count(), messages.siteKeys().length * LocaleMap.LOCALES.length);
    strictEqual(await client.message.count({ where: { editedAt: { not: null } } }), 0);
    const heroEn = await client.message.findUnique({ where: { key_locale: { key: 'hero.title', locale: 'en' } } });
    strictEqual(heroEn?.value, messages.siteDefault('hero.title', Locale.EN));

    const media = await client.media.findMany({ where: { ownerId: harness.ownerId } });
    strictEqual(media.length, SEED_MEDIA_KEYS.length);
    for (const row of media) {
      match(row.uuid, SEED_UUID);
      strictEqual(row.key, `admin/${harness.ownerId}/${row.uuid}/image.webp`);
      strictEqual(row.url, `/media/${row.key}`);
      strictEqual(row.mime, MEDIA_MIME);
      ok(row.width > 0 && row.width <= 2400 && row.height > 0 && row.height <= 2400, row.key);
      strictEqual((await harness.disk.stat(row.key)).size, row.size, row.key);
    }
    const ids = await mediaIdsByKey();
    for (const key of SEED_MEDIA_KEYS) {
      const row = media.find(item => item.id === ids[key]);
      deepStrictEqual(row?.alt, catalog.mediaAlt(key), key);
      const source = await new SeedAssets().read(SEED_MEDIA_SOURCES[key]);
      strictEqual(row?.uuid, identity.mediaUuid(key, identity.contentHash(source)), key);
    }

    deepStrictEqual(
      await client.contentImage.findMany({ orderBy: { key: 'asc' }, select: { key: true, mediaId: true } }),
      [
        { key: ABOUT_IMAGE, mediaId: ids[SeedMediaKey.HOODIE_BLACK_BACK] },
        { key: TAILORING_IMAGE, mediaId: ids[SeedMediaKey.LEKALA_RACK] },
      ],
    );
  });

  it('first run: the demo collection, products with photos and the other demo entities', async () => {
    const { client } = harness;
    const ids = await mediaIdsByKey();
    const collection = await client.collection.findUniqueOrThrow({ where: { slug: 'menya-zapomnyat' } });
    deepStrictEqual(
      { title: collection.title, cover: collection.coverId, published: collection.published, order: collection.order },
      { title: catalog.collection().title, cover: ids[SeedMediaKey.HOODIE_BLACK_BACK], published: true, order: 0 },
    );
    const products = await client.product.findMany({
      where: { collectionId: collection.id },
      orderBy: { order: 'asc' },
      include: { images: { orderBy: { order: 'asc' } } },
    });
    deepStrictEqual(
      products.map(product => [
        product.slug,
        product.order,
        product.price,
        product.published,
        product.images.map(image => image.mediaId),
      ]),
      [
        ['hoodie-white-logo', 0, null, true, [ids[SeedMediaKey.HOODIE_WHITE_LOGO]]],
        ['hoodie-white-head', 1, null, true, [ids[SeedMediaKey.HOODIE_WHITE_HEAD]]],
        ['hoodie-white-scales', 2, null, true, [ids[SeedMediaKey.HOODIE_WHITE_SCALES]]],
        ['hoodie-black-back', 3, null, true, [ids[SeedMediaKey.HOODIE_BLACK_BACK]]],
      ],
    );
    deepStrictEqual(products[0]?.details, catalog.products()[0]?.details);

    const reviews = await client.review.findMany({ orderBy: { order: 'asc' } });
    deepStrictEqual(
      reviews.map(review => [review.id, review.author, review.rating, review.published]),
      [
        [rowIds.idOf('seed-review-1'), 'Сергей', 5, true],
        [rowIds.idOf('seed-review-2'), 'Анна', 5, true],
        [rowIds.idOf('seed-review-3'), 'Дмитрий', 5, true],
      ],
    );
    const news = await client.newsItem.findMany({ orderBy: { date: 'asc' } });
    deepStrictEqual(
      news.map(item => [item.slug, item.date.toISOString(), item.imageId, item.published]),
      [
        [
          'kollekciya-menya-zapomnyat-v-kataloge',
          '2026-10-01T09:00:00.000Z',
          ids[SeedMediaKey.HOODIE_WHITE_LOGO],
          true,
        ],
        ['pop-up-v-krasnodare', '2026-10-10T09:00:00.000Z', ids[SeedMediaKey.PACKAGING], true],
      ],
    );
    const gallery = await client.galleryItem.findMany({ orderBy: { order: 'asc' } });
    deepStrictEqual(
      gallery.map(item => item.mediaId),
      [
        SeedMediaKey.SNAKE_HEAD_CLOSEUP,
        SeedMediaKey.LABEL_LOGO,
        SeedMediaKey.HANGTAG,
        SeedMediaKey.WORDMARK_PATTERN_RED,
        SeedMediaKey.LABEL_TONGUE,
        SeedMediaKey.STYLE_ELEMENTS,
      ].map(key => ids[key]),
    );
    ok(gallery.every(item => item.published));
  });

  it('first run: offers, partner drafts, menu, social link and the settings with a 5-star scale', async () => {
    const { client } = harness;
    const ids = await mediaIdsByKey();
    const offers = await client.offer.findMany({ orderBy: { order: 'asc' } });
    deepStrictEqual(
      offers.map(offer => [offer.ctaHref, offer.validUntil?.toISOString() ?? null, offer.imageId, offer.badge]),
      [
        ['#tailoring', '2026-12-31T20:59:59.000Z', ids[SeedMediaKey.LEKALA_RACK], catalog.offers()[0]?.badge],
        ['#contacts', null, ids[SeedMediaKey.PACKAGING], catalog.offers()[1]?.badge],
      ],
    );
    const partners = await client.partner.findMany({ orderBy: { order: 'asc' } });
    deepStrictEqual(
      partners.map(partner => [partner.name, partner.url, partner.published]),
      [
        ['Партнёр 01', null, false],
        ['Партнёр 02', null, false],
        ['Партнёр 03', null, false],
      ],
    );
    const menu = await client.menuItem.findMany({ orderBy: { order: 'asc' } });
    deepStrictEqual(
      menu.map(item => [item.href, item.showInHeader, item.showInFooter, item.published]),
      ['#home', '#catalog', '#about', '#tailoring', '#offers', '#contacts'].map(href => [href, true, true, true]),
    );
    const socials = await client.socialLink.findMany();
    deepStrictEqual(
      socials.map(link => [link.id, link.type, link.label, link.url, link.published]),
      [[rowIds.idOf('seed-social-telegram'), SocialType.TELEGRAM, {}, 'https://t.me/', true]],
    );
    const settings = await client.siteSettings.findUniqueOrThrow({ where: { id: 1 } });
    deepStrictEqual(
      [settings.phone, settings.email, settings.reviewRatingMax, settings.ogImageId, settings.seoTitle],
      ['+7 (000) 000-00-00', 'hello@example.com', 5, ids[SeedMediaKey.WORDMARK_ON_BLACK], catalog.settings().seoTitle],
    );
  });

  it('a second run changes nothing: no row, no timestamp, no object', async () => {
    const before = await SeedTestSnapshot.take(harness.client);
    const media = await harness.client.media.findMany({ select: { key: true } });
    const stamps = await Promise.all(media.map(row => objectStamp(row.key)));
    await harness.seed(SeedMode.KEEP_EDITS);
    deepStrictEqual(await SeedTestSnapshot.take(harness.client), before);
    deepStrictEqual(await Promise.all(media.map(row => objectStamp(row.key))), stamps);
  });

  it('keeps every admin edit, rolls new defaults out to seed rows and keeps orphan rows', async () => {
    const { client } = harness;
    const ids = await mediaIdsByKey();
    const editedAt = new Date();
    await client.message.update({
      where: { key_locale: { key: 'hero.title', locale: 'ru' } },
      data: { value: 'Правка', editedAt },
    });
    await client.message.update({
      where: { key_locale: { key: 'about.title', locale: 'en' } },
      data: { value: 'Old default' },
    });
    await client.message.create({ data: { key: 'zz.removed', locale: 'ru', value: 'orphan' } });
    const product = await client.product.update({
      where: { slug: 'hoodie-white-logo' },
      data: { title: { ru: 'Своё' } },
    });
    await client.productImage.deleteMany({ where: { productId: product.id } });
    await client.review.delete({ where: { id: rowIds.idOf('seed-review-2') } });
    await client.media.update({ where: { id: ids[SeedMediaKey.PACKAGING] }, data: { alt: { ru: 'Своя подпись' } } });
    await client.contentImage.update({ where: { key: ABOUT_IMAGE }, data: { mediaId: null } });
    await client.siteSettings.update({ where: { id: 1 }, data: { phone: '+7 (999) 111-22-33' } });

    await harness.seed(SeedMode.KEEP_EDITS);

    const hero = await client.message.findUniqueOrThrow({ where: { key_locale: { key: 'hero.title', locale: 'ru' } } });
    deepStrictEqual([hero.value, hero.editedAt?.toISOString()], ['Правка', editedAt.toISOString()]);
    const about = await client.message.findUniqueOrThrow({
      where: { key_locale: { key: 'about.title', locale: 'en' } },
    });
    strictEqual(about.value, messages.siteDefault('about.title', Locale.EN));
    strictEqual(await client.message.count({ where: { key: 'zz.removed' } }), 1);
    deepStrictEqual((await client.product.findUniqueOrThrow({ where: { id: product.id } })).title, { ru: 'Своё' });
    strictEqual(await client.productImage.count({ where: { productId: product.id } }), 0);
    strictEqual(await client.review.count({ where: { id: rowIds.idOf('seed-review-2') } }), 0);
    deepStrictEqual((await client.media.findUniqueOrThrow({ where: { id: ids[SeedMediaKey.PACKAGING] } })).alt, {
      ru: 'Своя подпись',
    });
    strictEqual((await client.contentImage.findUniqueOrThrow({ where: { key: ABOUT_IMAGE } })).mediaId, null);
    strictEqual((await client.siteSettings.findUniqueOrThrow({ where: { id: 1 } })).phone, '+7 (999) 111-22-33');
  });

  it('seeds the image of a content image key without a row, restoring its lost object', async () => {
    const { client } = harness;
    const ids = await mediaIdsByKey();
    const lekala = await client.media.findUniqueOrThrow({ where: { id: ids[SeedMediaKey.LEKALA_RACK] } });
    await client.contentImage.delete({ where: { key: TAILORING_IMAGE } });
    await harness.disk.delete(lekala.key);

    await harness.seed(SeedMode.KEEP_EDITS);

    const row = await client.contentImage.findUniqueOrThrow({ where: { key: TAILORING_IMAGE } });
    strictEqual(row.mediaId, lekala.id);
    strictEqual((await harness.disk.stat(lekala.key)).size > 0, true);
    strictEqual(await client.media.count(), SEED_MEDIA_KEYS.length);
    deepStrictEqual((await client.product.findUniqueOrThrow({ where: { slug: 'hoodie-white-logo' } })).title, {
      ru: 'Своё',
    });
  });

  it('a full run over existing demo rows (no settings row: an interrupted seed) only adds what is missing', async () => {
    const { client } = harness;
    await client.siteSettings.delete({ where: { id: 1 } });
    const before = await SeedTestSnapshot.take(client);

    await harness.seed(SeedMode.KEEP_EDITS);

    const { settings, reviews, ...rest } = await SeedTestSnapshot.take(client);
    const { settings: noSettings, reviews: reviewsBefore, ...restBefore } = before;
    deepStrictEqual(rest, restBefore, 'existing rows untouched (the edited product, its photos, alt texts, images)');
    deepStrictEqual([noSettings?.length, settings?.length], [0, 1]);
    const reviewRows = await client.review.findMany({ orderBy: { order: 'asc' }, select: { id: true } });
    deepStrictEqual(
      reviewRows.map(row => row.id),
      ['seed-review-1', 'seed-review-2', 'seed-review-3'].map(name => rowIds.idOf(name)),
    );
    const unchanged = (reviews ?? []).filter(row => (reviewsBefore ?? []).some(old => isDeepStrictEqual(old, row)));
    strictEqual(unchanged.length, 2, 'the two kept reviews are unchanged, the deleted one is created again');
  });

  it('SEED_OVERWRITE=1 resets every seeded row to the seed copy (orphans stay, no new media)', async () => {
    const { client } = harness;
    const ids = await mediaIdsByKey();
    await harness.seed(SeedMode.OVERWRITE);

    const hero = await client.message.findUniqueOrThrow({ where: { key_locale: { key: 'hero.title', locale: 'ru' } } });
    deepStrictEqual([hero.value, hero.editedAt], [messages.siteDefault('hero.title', Locale.RU), null]);
    strictEqual(await client.message.count({ where: { key: 'zz.removed' } }), 1);
    const product = await client.product.findUniqueOrThrow({
      where: { slug: 'hoodie-white-logo' },
      include: { images: true },
    });
    deepStrictEqual(product.title, catalog.products()[0]?.title);
    deepStrictEqual(
      product.images.map(image => [image.mediaId, image.order]),
      [[ids[SeedMediaKey.HOODIE_WHITE_LOGO], 0]],
    );
    strictEqual(await client.review.count(), 3);
    deepStrictEqual(
      (await client.media.findUniqueOrThrow({ where: { id: ids[SeedMediaKey.PACKAGING] } })).alt,
      catalog.mediaAlt(SeedMediaKey.PACKAGING),
    );
    strictEqual(
      (await client.contentImage.findUniqueOrThrow({ where: { key: ABOUT_IMAGE } })).mediaId,
      ids[SeedMediaKey.HOODIE_BLACK_BACK],
    );
    strictEqual((await client.siteSettings.findUniqueOrThrow({ where: { id: 1 } })).phone, '+7 (000) 000-00-00');
    strictEqual(await client.media.count(), SEED_MEDIA_KEYS.length);
  });

  it('an edited asset: kept at the older image without SEED_OVERWRITE, re-pointed to a new one with it', async () => {
    const { client } = harness;
    const ids = await mediaIdsByKey();
    const edited = [
      { provide: SeedAssets, useValue: new EditedAssets(SeedMediaKey.HOODIE_BLACK_BACK, SeedMediaKey.HANGTAG) },
    ];
    await client.contentImage.delete({ where: { key: ABOUT_IMAGE } });

    await harness.seed(SeedMode.KEEP_EDITS, edited);
    strictEqual(
      (await client.contentImage.findUniqueOrThrow({ where: { key: ABOUT_IMAGE } })).mediaId,
      ids[SeedMediaKey.HOODIE_BLACK_BACK],
    );
    strictEqual(await client.media.count(), SEED_MEDIA_KEYS.length);

    await harness.seed(SeedMode.OVERWRITE, edited);
    const replacement = await client.media.findFirstOrThrow({
      where: { originalName: 'hoodie-black-back.jpg', id: { not: ids[SeedMediaKey.HOODIE_BLACK_BACK] } },
    });
    match(replacement.uuid, SEED_UUID);
    strictEqual((await harness.disk.stat(replacement.key)).size, replacement.size);
    deepStrictEqual(replacement.alt, catalog.mediaAlt(SeedMediaKey.HOODIE_BLACK_BACK));
    strictEqual((await client.contentImage.findUniqueOrThrow({ where: { key: ABOUT_IMAGE } })).mediaId, replacement.id);
    strictEqual(
      (await client.collection.findUniqueOrThrow({ where: { slug: 'menya-zapomnyat' } })).coverId,
      replacement.id,
    );
    const back = await client.product.findUniqueOrThrow({
      where: { slug: 'hoodie-black-back' },
      include: { images: true },
    });
    deepStrictEqual(
      back.images.map(image => image.mediaId),
      [replacement.id],
    );
    strictEqual(await client.media.count(), SEED_MEDIA_KEYS.length + 1, 'the older row stays in the media library');
  });

  it('a reset database reuses the objects already in the bucket (same keys, nothing uploaded)', async () => {
    const before = await harness.client.media.findMany({ select: { key: true } });
    const stamps = new Map(await Promise.all(before.map(async row => [row.key, await objectStamp(row.key)] as const)));

    await harness.resetDatabase();
    await harness.seed(SeedMode.KEEP_EDITS);

    const after = await harness.client.media.findMany({ select: { uuid: true, key: true, size: true } });
    strictEqual(after.length, SEED_MEDIA_KEYS.length);
    for (const row of after) {
      notStrictEqual(stamps.get(row.key), undefined, `same key as before the reset: ${row.key}`);
      strictEqual(await objectStamp(row.key), stamps.get(row.key), row.key);
      strictEqual((await harness.disk.stat(row.key)).size, row.size, row.key);
    }
  });
});
