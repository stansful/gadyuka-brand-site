import { SocialType } from '~core/socials/social-type';

import { SeedMediaKey } from './seed-media-key.enum';

/**
 * Demo entities — the non-text data (slugs, row names, images, dates, ratings, links). Every text comes
 * from shared/messages/content/<locale>.json (SeedCopy, DemoEntityCatalog). Port of the frontend's
 * prisma/seed-data/entities.ts.
 *
 * RULE: the collection «Меня запомнят» is never described as first / debut / №1.
 * Reviews, news, offers and partners are PLACEHOLDERS to be replaced in the admin.
 */

export interface DemoCollectionDefinition {
  readonly slug: string;
  readonly cover: SeedMediaKey;
  readonly order: number;
}

export interface DemoProductDefinition {
  readonly slug: string;
  readonly images: readonly SeedMediaKey[];
}

export interface DemoReviewDefinition {
  /** Seed row name (SeedRowIds) and key of its copy (`reviews.<name>`) */
  readonly name: string;
  /** 1..DEMO_SETTINGS.reviewRatingMax */
  readonly rating: number;
}

export interface DemoNewsDefinition {
  readonly slug: string;
  /** ISO 8601 */
  readonly date: string;
  readonly image: SeedMediaKey;
}

export interface DemoGalleryDefinition {
  readonly name: string;
  readonly media: SeedMediaKey;
}

export interface DemoOfferDefinition {
  readonly name: string;
  readonly ctaHref: string;
  /** ISO 8601, or null (no end date) */
  readonly validUntil: string | null;
  readonly image: SeedMediaKey | null;
}

export interface DemoMenuDefinition {
  /** Key of its label in the copy (`menu.<label>`); the row name is `seed-menu-<label>` */
  readonly label: string;
  /** In-page anchor of the landing section (the site's SECTION_ANCHORS) */
  readonly anchor: string;
}

export interface DemoSocialLinkDefinition {
  readonly name: string;
  readonly type: SocialType;
  readonly url: string;
  readonly published: boolean;
}

export interface DemoSettingsDefinition {
  readonly phone: string;
  readonly email: string;
  readonly reviewRatingMax: number;
  readonly ogImage: SeedMediaKey;
}

export const DEMO_COLLECTION: DemoCollectionDefinition = {
  slug: 'menya-zapomnyat',
  cover: SeedMediaKey.HOODIE_BLACK_BACK,
  order: 0,
};

/** Products of DEMO_COLLECTION, in catalog order. */
export const DEMO_PRODUCTS: readonly DemoProductDefinition[] = [
  { slug: 'hoodie-white-logo', images: [SeedMediaKey.HOODIE_WHITE_LOGO] },
  { slug: 'hoodie-white-head', images: [SeedMediaKey.HOODIE_WHITE_HEAD] },
  { slug: 'hoodie-white-scales', images: [SeedMediaKey.HOODIE_WHITE_SCALES] },
  { slug: 'hoodie-black-back', images: [SeedMediaKey.HOODIE_BLACK_BACK] },
];

export const DEMO_REVIEWS: readonly DemoReviewDefinition[] = [
  { name: 'seed-review-1', rating: 5 },
  { name: 'seed-review-2', rating: 5 },
  { name: 'seed-review-3', rating: 5 },
];

export const DEMO_NEWS: readonly DemoNewsDefinition[] = [
  {
    slug: 'kollekciya-menya-zapomnyat-v-kataloge',
    date: '2026-10-01T09:00:00.000Z',
    image: SeedMediaKey.HOODIE_WHITE_LOGO,
  },
  { slug: 'pop-up-v-krasnodare', date: '2026-10-10T09:00:00.000Z', image: SeedMediaKey.PACKAGING },
];

export const DEMO_GALLERY: readonly DemoGalleryDefinition[] = [
  { name: 'seed-gallery-1', media: SeedMediaKey.SNAKE_HEAD_CLOSEUP },
  { name: 'seed-gallery-2', media: SeedMediaKey.LABEL_LOGO },
  { name: 'seed-gallery-3', media: SeedMediaKey.HANGTAG },
  { name: 'seed-gallery-4', media: SeedMediaKey.WORDMARK_PATTERN_RED },
  { name: 'seed-gallery-5', media: SeedMediaKey.LABEL_TONGUE },
  { name: 'seed-gallery-6', media: SeedMediaKey.STYLE_ELEMENTS },
];

export const DEMO_OFFERS: readonly DemoOfferDefinition[] = [
  {
    name: 'seed-offer-1',
    ctaHref: '#tailoring',
    validUntil: '2026-12-31T20:59:59.000Z',
    image: SeedMediaKey.LEKALA_RACK,
  },
  { name: 'seed-offer-2', ctaHref: '#contacts', validUntil: null, image: SeedMediaKey.PACKAGING },
];

/**
 * Partner rows are DRAFTS (published: false): Partner.name is one string for every language (a brand
 * name), so a placeholder like «Партнёр 01» would show Russian on the English site. Until real partners
 * are added, the site shows its own localized free slots; the drafts are templates in the admin — fill
 * in the real name and logo, then publish.
 */
export const DEMO_PARTNER_NAMES: readonly string[] = ['seed-partner-1', 'seed-partner-2', 'seed-partner-3'];

/**
 * The site menu (header, mobile menu and footer list the same items) in the order of the chapters on
 * the page: Главная, Каталог, О нас, Индивидуальный пошив, Специальное предложение, Контакты. Hrefs are
 * landing anchors ("#home" is the cover).
 */
export const DEMO_MENU: readonly DemoMenuDefinition[] = [
  { label: 'home', anchor: 'home' },
  { label: 'catalog', anchor: 'catalog' },
  { label: 'about', anchor: 'about' },
  { label: 'tailoring', anchor: 'tailoring' },
  { label: 'offers', anchor: 'offers' },
  { label: 'contacts', anchor: 'contacts' },
];

/**
 * PLACEHOLDER — the bare https://t.me/ is shown in «Контакты» like the placeholder phone and e-mail (a
 * preview of the block; JSON-LD sameAs skips URLs without a path). An empty label = the site shows the
 * default label of the type (message `social.<type>`).
 */
export const DEMO_SOCIAL_LINKS: readonly DemoSocialLinkDefinition[] = [
  { name: 'seed-social-telegram', type: SocialType.TELEGRAM, url: 'https://t.me/', published: true },
];

export const DEMO_SETTINGS: DemoSettingsDefinition = {
  /** PLACEHOLDER — replace in the admin («Настройки»). */
  phone: '+7 (000) 000-00-00',
  /** PLACEHOLDER — example.com is a reserved demo domain. */
  email: 'hello@example.com',
  reviewRatingMax: 5,
  ogImage: SeedMediaKey.WORDMARK_ON_BLACK,
};
