import { deepStrictEqual, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import { Locale } from '~core/locales/locale.enum';
import { ReviewRatingScale } from '~core/reviews/review-rating-scale';
import { SocialType } from '~core/socials/social-type';
import { PublicCollectionPresenter } from '~usecases/public/content/common/public-collection.presenter';
import { PublicImagePresenter } from '~usecases/public/content/common/public-image.presenter';
import { PublicMediaRow } from '~usecases/public/content/common/public-media.select';
import { PublicSettingsPresenter } from '~usecases/public/content/common/public-settings.presenter';

import { LandingFramePresenter } from './landing-frame.presenter';
import { LandingRows } from './landing-rows.loader';
import { LandingSectionsPresenter } from './landing-sections.presenter';
import { LandingPresenter } from './landing.presenter';
import { LandingSectionRows, ReviewRow } from './landing.repository';

const images = new PublicImagePresenter();
const frame = new LandingFramePresenter(images);
const sections = new LandingSectionsPresenter(images);
const settings = new PublicSettingsPresenter(images);
const landing = new LandingPresenter(frame, sections, new PublicCollectionPresenter(images), settings);

const media = (id: string, alt: unknown = { ru: 'Фото', en: 'Photo' }): PublicMediaRow => ({
  id,
  url: `/media/admin/u/${id}/image.webp`,
  width: 4,
  height: 3,
  mime: 'image/webp',
  alt,
});

describe('PublicImagePresenter (media rows → pictures)', () => {
  it('localizes the alt text without a fallback and keeps the Russian one apart', () => {
    deepStrictEqual(images.toImage(media('m1', { ru: 'Пальто' }), Locale.EN), {
      id: 'm1',
      src: '/media/admin/u/m1/image.webp',
      width: 4,
      height: 3,
      mime: 'image/webp',
      alt: '',
      altDefault: 'Пальто',
    });
    strictEqual(images.toImage(media('m1'), Locale.EN).alt, 'Photo');
    strictEqual(images.toOptionalImage(null, Locale.RU), null);
  });
});

describe('LandingFramePresenter (menu, social links, landing images)', () => {
  const item = { id: 'm1', href: '#about', showInHeader: true, showInFooter: false };

  it('localizes menu labels (ru fallback) and skips items without any label', () => {
    deepStrictEqual(frame.toMenu([{ ...item, label: { ru: 'О нас', en: 'About' } }], Locale.EN), [
      { ...item, label: 'About' },
    ]);
    deepStrictEqual(frame.toMenu([{ ...item, label: { ru: 'О нас' } }], Locale.EN), [{ ...item, label: 'О нас' }]);
    deepStrictEqual(frame.toMenu([{ ...item, label: {} }], Locale.RU), []);
  });

  it('leaves an empty social label null (the site then shows social.<type>)', () => {
    const link = { id: 's1', type: SocialType.TELEGRAM, url: 'https://t.me/gadyuka' };
    deepStrictEqual(frame.toSocials([{ ...link, label: {} }], Locale.RU), [{ ...link, label: null }]);
    deepStrictEqual(frame.toSocials([{ ...link, label: { ru: 'Канал' } }], Locale.EN), [{ ...link, label: 'Канал' }]);
  });

  it('keys the landing images by ContentImage key, null for a slot without media', () => {
    const result = frame.toImages(
      [
        { key: 'about.image', media: media('m1') },
        { key: 'tailoring.image', media: null },
      ],
      Locale.RU,
    );
    deepStrictEqual(Object.keys(result), ['about.image', 'tailoring.image']);
    strictEqual(result['about.image']?.alt, 'Фото');
    strictEqual(result['tailoring.image'], null);
  });
});

describe('LandingSectionsPresenter (reviews, news, gallery, offers, partners)', () => {
  const review = (rating: number | null): ReviewRow => ({
    id: 'r1',
    author: 'Аня',
    role: { ru: 'покупатель' },
    text: { ru: 'Отлично', en: 'Great' },
    rating,
    avatar: null,
  });

  it('keeps review ratings on the current star scale', () => {
    const ratings = sections
      .toReviews([review(null), review(4), review(8)], ReviewRatingScale.of(5), Locale.EN)
      .map(row => row.rating);
    deepStrictEqual(ratings, [null, 4, 5]);
    const [localized] = sections.toReviews([review(3)], ReviewRatingScale.of(5), Locale.EN);
    deepStrictEqual({ role: localized?.role, text: localized?.text }, { role: 'покупатель', text: 'Great' });
  });

  it('dates news and offers as ISO strings, keeps an open-ended offer open', () => {
    const date = new Date('2026-10-01T09:00:00.000Z');
    const [news] = sections.toNews(
      [{ id: 'n1', slug: 'drop', title: { ru: 'Дроп' }, excerpt: {}, body: {}, date, image: null }],
      Locale.EN,
    );
    deepStrictEqual(
      { title: news?.title, excerpt: news?.excerpt, date: news?.date },
      {
        title: 'Дроп',
        excerpt: '',
        date: '2026-10-01T09:00:00.000Z',
      },
    );
    const offer = { id: 'o1', title: { ru: 'Скидка' }, text: {}, badge: {}, ctaLabel: {}, ctaHref: null, image: null };
    deepStrictEqual(
      sections
        .toOffers(
          [
            { ...offer, validUntil: date },
            { ...offer, validUntil: null },
          ],
          Locale.RU,
        )
        .map(row => row.validUntil),
      ['2026-10-01T09:00:00.000Z', null],
    );
  });

  it('leaves out a gallery row without its picture', () => {
    const rows = [
      { id: 'g1', caption: { ru: 'Съёмка' }, media: media('m1') },
      { id: 'g2', caption: {}, media: null },
    ];
    deepStrictEqual(
      sections.toGallery(rows, Locale.RU).map(row => [row.id, row.caption]),
      [['g1', 'Съёмка']],
    );
  });
});

describe('LandingPresenter (the whole answer)', () => {
  const now = new Date('2026-10-16T20:00:00.000Z');
  const offer = (validUntil: Date | null) => ({
    id: `o-${validUntil?.getTime() ?? 'open'}`,
    title: { ru: 'Скидка' },
    text: {},
    badge: {},
    ctaLabel: {},
    ctaHref: null,
    validUntil,
    image: null,
  });
  const emptySections: LandingSectionRows = { reviews: [], news: [], gallery: [], offers: [], partners: [] };
  const rows = (changes: Partial<LandingRows> = {}): LandingRows => ({
    texts: { 'hero.title': 'ГАДЮКА' },
    settings: null,
    collections: [],
    frame: { images: [], menu: [], socials: [] },
    sections: emptySections,
    ...changes,
  });

  it('answers the settings defaults before the settings were saved, and rates on that scale', () => {
    const review = { id: 'r1', author: 'A', role: {}, text: { ru: 'x' }, rating: 9, avatar: null };
    const response = landing.toResponse(rows({ sections: { ...emptySections, reviews: [review] } }), Locale.RU, now);
    deepStrictEqual(response.settings, {
      phone: '',
      email: '',
      address: '',
      reviewRatingMax: 5,
      seoTitle: '',
      seoDescription: '',
      ogImage: null,
    });
    strictEqual(response.reviews[0]?.rating, 5);
    deepStrictEqual(response.texts, { 'hero.title': 'ГАДЮКА' });
  });

  it('rates on the saved scale and localizes the saved settings', () => {
    const saved = {
      phone: '+7 900',
      email: 'a@b.c',
      address: { ru: 'Москва', en: 'Moscow' },
      reviewRatingMax: 10,
      seoTitle: { ru: 'ГАДЮКА' },
      seoDescription: {},
      ogImage: media('og'),
    };
    const review = { id: 'r1', author: 'A', role: {}, text: { ru: 'x' }, rating: 9, avatar: null };
    const response = landing.toResponse(
      rows({ settings: saved, sections: { ...emptySections, reviews: [review] } }),
      Locale.EN,
      now,
    );
    deepStrictEqual([response.settings.address, response.settings.seoTitle], ['Moscow', 'ГАДЮКА']);
    strictEqual(response.settings.ogImage?.id, 'og');
    strictEqual(response.reviews[0]?.rating, 9);
  });

  it('hints the earliest end of the listed offers (null when none ends)', () => {
    const soon = new Date(now.getTime() + 10 * 60_000);
    const later = new Date(now.getTime() + 30 * 60_000);
    const offers = [offer(later), offer(null), offer(soon)];
    const response = landing.toResponse(rows({ sections: { ...emptySections, offers } }), Locale.RU, now);
    strictEqual(response.offersExpireAt, soon.toISOString());
    strictEqual(landing.toResponse(rows(), Locale.RU, now).offersExpireAt, null);
  });

  it('localizes the catalog: products with their detail lines and pictures', () => {
    const collection = {
      id: 'c1',
      slug: 'noir',
      title: { ru: 'Нуар', en: 'Noir' },
      description: {},
      cover: null,
      products: [
        {
          id: 'p1',
          slug: 'coat',
          title: { ru: 'Пальто' },
          description: {},
          details: { ru: 'шерсть\n\n оверсайз ' },
          price: null,
          images: [{ media: media('m1') }],
        },
      ],
    };
    const [view] = landing.toResponse(rows({ collections: [collection] }), Locale.EN, now).collections;
    deepStrictEqual({ title: view?.title, cover: view?.cover }, { title: 'Noir', cover: null });
    const product = view?.products[0];
    deepStrictEqual(
      { title: product?.title, details: product?.details, price: product?.price, image: product?.images[0]?.id },
      { title: 'Пальто', details: ['шерсть', 'оверсайз'], price: null, image: 'm1' },
    );
  });
});
