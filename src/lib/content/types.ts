import type { Locale } from '@/i18n/locales';

import type { ImageKey, TextKey } from './registry';
import type { SocialType } from './social';

/**
 * View models returned by the content read layer. Everything is already localized
 * (plain strings) and serializable (dates are ISO strings) so it can cross the
 * "use cache" boundary and be passed to client components.
 */

export type ImageRef = {
  /** Media.id */
  id: string;
  /** Public URL (Media.url), e.g. "/media/admin/<ownerId>/<uuid>/image.webp" */
  src: string;
  width: number;
  height: number;
  mime: string;
  /** Alt text in the page's locale ("" when not filled in for it — no fallback) */
  alt: string;
  /** Alt text in the default locale (ru); use after any localized fallback: `alt || fallbackAlt || altDefault` */
  altDefault: string;
};

export type ProductView = {
  id: string;
  slug: string;
  title: string;
  description: string;
  /** Product.details split into non-empty lines */
  details: string[];
  /** Whole rubles; null = price on request */
  price: number | null;
  images: ImageRef[];
};

export type CollectionView = {
  id: string;
  slug: string;
  title: string;
  description: string;
  cover: ImageRef | null;
  products: ProductView[];
};

export type ReviewView = {
  id: string;
  author: string;
  role: string;
  text: string;
  avatar: ImageRef | null;
  /** 1..settings.reviewRatingMax (clamped when the scale was lowered later); null = no rating. */
  rating: number | null;
};

export type NewsView = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  /** ISO 8601 */
  date: string;
  image: ImageRef | null;
};

export type GalleryView = {
  id: string;
  caption: string;
  image: ImageRef;
};

export type OfferView = {
  id: string;
  title: string;
  text: string;
  /** "" = no badge */
  badge: string;
  /** "" = no button */
  ctaLabel: string;
  ctaHref: string | null;
  /** ISO 8601 or null (no end date) */
  validUntil: string | null;
  image: ImageRef | null;
};

export type PartnerView = {
  id: string;
  name: string;
  url: string | null;
  description: string;
  logo: ImageRef | null;
};

/** A published MenuItem; the header and the footer each list the items flagged for them. */
export type MenuItemView = {
  id: string;
  /** Localized label (falls back to ru; items without any label are not returned). */
  label: string;
  /** As stored: "#catalog" (landing anchor), "/catalog/<slug>" (site path), "https://…", "mailto:", "tel:" */
  href: string;
  showInHeader: boolean;
  showInFooter: boolean;
};

/** A published SocialLink (contacts section, JSON-LD sameAs). */
export type SocialLinkView = {
  id: string;
  type: SocialType;
  url: string;
  /** Own localized label (falls back to ru); null = use the default label, message `social.<type>`. */
  label: string | null;
};

export type SettingsView = {
  phone: string;
  email: string;
  address: string;
  /** Number of stars of the review rating scale (Review.rating is 1..reviewRatingMax). */
  reviewRatingMax: number;
  seoTitle: string;
  seoDescription: string;
  ogImage: ImageRef | null;
};

/** Everything the landing page renders, for one locale. */
export type LandingContent = {
  locale: Locale;
  /**
   * Every site message for this locale (DB rows over the messages/<locale>.json defaults, see
   * resolveMessageValues in src/i18n/messages.ts); "" only when emptied on purpose.
   */
  texts: Record<TextKey, string>;
  /** ContentImage images; null when no media is assigned. */
  images: Record<ImageKey, ImageRef | null>;
  /** Published menu items, ordered (MenuItem.order). */
  menu: MenuItemView[];
  /** Published social links, ordered (SocialLink.order). */
  socials: SocialLinkView[];
  /** Published collections (ordered) with their published products (ordered). */
  collections: CollectionView[];
  reviews: ReviewView[];
  /** Published news, newest first. */
  news: NewsView[];
  gallery: GalleryView[];
  /** Published offers that have not expired (validUntil >= now or null). */
  offers: OfferView[];
  partners: PartnerView[];
  settings: SettingsView;
  /** Current year at cache time (for "© ГАДЮКА, 2026"). */
  year: number;
};
