import type { SocialType } from '@/generated/prisma/enums';
import type { LocalizedText } from '@/lib/i18n-text';
import type { SeedMediaKey } from './media';

import { SECTION_ANCHORS } from '@/lib/content/anchors';
import { defaultCopy, localized, type SeedCopy } from './copy';

/**
 * Seed entities: the non-text data (slugs, ids, image keys, dates, ratings, links) — every text
 * comes from messages/content/<locale>.json through ./copy. Rows without a natural unique key
 * get deterministic ids ("seed-…") so re-running the seed upserts instead of duplicating.
 *
 * RULE: the collection «Меня запомнят» is never described as first / debut / №1.
 * Reviews, news, offers and partners are PLACEHOLDERS to be replaced in the admin.
 */

/** Id of the ADMIN user the seed creates (owner of the seed media: S3 keys admin/seed-admin/…). */
export const SEED_ADMIN_USER_ID = 'seed-admin';

/** Fallback name of the seed ADMIN user when messages/content has none. */
export const SEED_ADMIN_FALLBACK_NAME = 'Администратор';

export function seedAdminName(): string {
  return defaultCopy(copy => copy.adminUser.name).trim() || SEED_ADMIN_FALLBACK_NAME;
}

type CollectionSlug = keyof SeedCopy['collections'];

const COLLECTION_SLUG: CollectionSlug = 'menya-zapomnyat';

export const SEED_COLLECTION: {
  slug: CollectionSlug;
  title: LocalizedText;
  description: LocalizedText;
  cover: SeedMediaKey;
  order: number;
} = {
  slug: COLLECTION_SLUG,
  title: localized(copy => copy.collections[COLLECTION_SLUG].title),
  description: localized(copy => copy.collections[COLLECTION_SLUG].description),
  cover: 'hoodieBlackBack',
  order: 0,
};

type SeedProduct = {
  slug: keyof SeedCopy['products'];
  title: LocalizedText;
  description: LocalizedText;
  details: LocalizedText;
  images: readonly SeedMediaKey[];
};

const PRODUCTS: ReadonlyArray<Pick<SeedProduct, 'slug' | 'images'>> = [
  { slug: 'hoodie-white-logo', images: ['hoodieWhiteLogo'] },
  { slug: 'hoodie-white-head', images: ['hoodieWhiteHead'] },
  { slug: 'hoodie-white-scales', images: ['hoodieWhiteScales'] },
  { slug: 'hoodie-black-back', images: ['hoodieBlackBack'] },
];

/** Products of SEED_COLLECTION, in catalog order. */
export const SEED_PRODUCTS: readonly SeedProduct[] = PRODUCTS.map(product => ({
  ...product,
  title: localized(copy => copy.products[product.slug].title),
  description: localized(copy => copy.products[product.slug].description),
  details: localized(copy => copy.products[product.slug].details),
}));

type SeedReview = {
  id: keyof SeedCopy['reviews'];
  /** Single-language column: the default-locale name. */
  author: string;
  role: LocalizedText;
  text: LocalizedText;
  /** 1..SEED_SETTINGS.reviewRatingMax */
  rating: number;
};

const REVIEWS: ReadonlyArray<Pick<SeedReview, 'id' | 'rating'>> = [
  { id: 'seed-review-1', rating: 5 },
  { id: 'seed-review-2', rating: 5 },
  { id: 'seed-review-3', rating: 5 },
];

export const SEED_REVIEWS: readonly SeedReview[] = REVIEWS.map(review => ({
  ...review,
  author: defaultCopy(copy => copy.reviews[review.id].author),
  role: localized(copy => copy.reviews[review.id].role),
  text: localized(copy => copy.reviews[review.id].text),
}));

type SeedNews = {
  slug: keyof SeedCopy['news'];
  title: LocalizedText;
  excerpt: LocalizedText;
  body: LocalizedText;
  /** ISO 8601 */
  date: string;
  image: SeedMediaKey;
};

const NEWS: ReadonlyArray<Pick<SeedNews, 'slug' | 'date' | 'image'>> = [
  { slug: 'kollekciya-menya-zapomnyat-v-kataloge', date: '2026-10-01T09:00:00.000Z', image: 'hoodieWhiteLogo' },
  { slug: 'pop-up-v-krasnodare', date: '2026-10-10T09:00:00.000Z', image: 'packaging' },
];

export const SEED_NEWS: readonly SeedNews[] = NEWS.map(item => ({
  ...item,
  title: localized(copy => copy.news[item.slug].title),
  excerpt: localized(copy => copy.news[item.slug].excerpt),
  body: localized(copy => copy.news[item.slug].body),
}));

type SeedGalleryItem = { id: keyof SeedCopy['gallery']; media: SeedMediaKey; caption: LocalizedText };

const GALLERY: ReadonlyArray<Pick<SeedGalleryItem, 'id' | 'media'>> = [
  { id: 'seed-gallery-1', media: 'snakeHeadCloseup' },
  { id: 'seed-gallery-2', media: 'labelLogo' },
  { id: 'seed-gallery-3', media: 'hangtag' },
  { id: 'seed-gallery-4', media: 'wordmarkPatternRed' },
  { id: 'seed-gallery-5', media: 'labelTongue' },
  { id: 'seed-gallery-6', media: 'styleElements' },
];

export const SEED_GALLERY: readonly SeedGalleryItem[] = GALLERY.map(item => ({
  ...item,
  caption: localized(copy => copy.gallery[item.id].caption),
}));

type SeedOffer = {
  id: keyof SeedCopy['offers'];
  title: LocalizedText;
  text: LocalizedText;
  badge: LocalizedText;
  ctaLabel: LocalizedText;
  ctaHref: string;
  /** ISO 8601 or null (no end date) */
  validUntil: string | null;
  image: SeedMediaKey | null;
};

const OFFERS: ReadonlyArray<Pick<SeedOffer, 'id' | 'ctaHref' | 'validUntil' | 'image'>> = [
  { id: 'seed-offer-1', ctaHref: '#tailoring', validUntil: '2026-12-31T20:59:59.000Z', image: 'lekalaRack' },
  { id: 'seed-offer-2', ctaHref: '#contacts', validUntil: null, image: 'packaging' },
];

export const SEED_OFFERS: readonly SeedOffer[] = OFFERS.map(offer => ({
  ...offer,
  title: localized(copy => copy.offers[offer.id].title),
  text: localized(copy => copy.offers[offer.id].text),
  badge: localized(copy => copy.offers[offer.id].badge),
  ctaLabel: localized(copy => copy.offers[offer.id].ctaLabel),
}));

/**
 * Partner rows are DRAFTS (published: false): Partner.name is one string for every language
 * (a brand name), so a placeholder like «Партнёр 01» would show Russian on the English site.
 * Until real partners are added, the site shows its own localized free slots («Место для
 * партнёра» / «Your brand here»); the drafts are templates in the admin — fill in the real
 * name and logo, then switch on «Показывать на сайте».
 */
type SeedPartner = {
  id: keyof SeedCopy['partners'];
  /** Single-language column: the default-locale name. */
  name: string;
  description: LocalizedText;
  published: false;
};

const PARTNER_IDS: ReadonlyArray<SeedPartner['id']> = ['seed-partner-1', 'seed-partner-2', 'seed-partner-3'];

export const SEED_PARTNERS: readonly SeedPartner[] = PARTNER_IDS.map(id => ({
  id,
  name: defaultCopy(copy => copy.partners[id].name),
  description: localized(copy => copy.partners[id].description),
  published: false,
}));

type SeedMenuItem = {
  id: string;
  label: LocalizedText;
  href: string;
  showInHeader: boolean;
  showInFooter: boolean;
};

/**
 * The site menu (header, mobile menu and footer list the same items) in the order of the
 * chapters on the page: Главная, Каталог, О нас, Индивидуальный пошив, Специальное
 * предложение, Контакты. Hrefs are landing anchors ("#home" is the cover).
 */
const MENU: ReadonlyArray<{ label: keyof SeedCopy['menu']; anchor: string }> = [
  { label: 'home', anchor: SECTION_ANCHORS.hero },
  { label: 'catalog', anchor: SECTION_ANCHORS.catalog },
  { label: 'about', anchor: SECTION_ANCHORS.about },
  { label: 'tailoring', anchor: SECTION_ANCHORS.tailoring },
  { label: 'offers', anchor: SECTION_ANCHORS.offers },
  { label: 'contacts', anchor: SECTION_ANCHORS.contacts },
];

export const SEED_MENU: readonly SeedMenuItem[] = MENU.map(item => ({
  id: `seed-menu-${item.label}`,
  label: localized(copy => copy.menu[item.label]),
  href: `#${item.anchor}`,
  showInHeader: true,
  showInFooter: true,
}));

type SeedSocialLink = {
  id: string;
  type: SocialType;
  /** Empty = the site shows the default label of the type (message `social.<type>`). */
  label: LocalizedText;
  url: string;
  published: boolean;
};

/**
 * PLACEHOLDER — the bare https://t.me/ is shown in «Контакты» like the placeholder phone and
 * e-mail (a preview of the block; JSON-LD sameAs skips URLs without a path). Put the real
 * channel in the admin, or switch the link off there.
 */
export const SEED_SOCIALS: readonly SeedSocialLink[] = [
  { id: 'seed-social-telegram', type: 'TELEGRAM', label: {}, url: 'https://t.me/', published: true },
];

export const SEED_SETTINGS: {
  phone: string;
  email: string;
  address: LocalizedText;
  reviewRatingMax: number;
  seoTitle: LocalizedText;
  seoDescription: LocalizedText;
  ogImage: SeedMediaKey;
} = {
  /** PLACEHOLDER — replace in the admin («Настройки»). */
  phone: '+7 (000) 000-00-00',
  /** PLACEHOLDER — example.com is a reserved demo domain. */
  email: 'hello@example.com',
  address: localized(copy => copy.settings.address),
  reviewRatingMax: 5,
  seoTitle: localized(copy => copy.settings.seoTitle),
  seoDescription: localized(copy => copy.settings.seoDescription),
  ogImage: 'wordmarkOnBlack',
};
