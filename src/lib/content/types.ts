import type { Locale } from "@/i18n/locales";
import type { ImageKey, TextKey } from "./registry";

/**
 * View models returned by the content read layer. Everything is already localized
 * (plain strings) and serializable (dates are ISO strings) so it can cross the
 * "use cache" boundary and be passed to client components.
 */

export type ImageRef = {
  /** Media.id */
  id: string;
  /** Public URL, e.g. "/uploads/seed/hoodie-white-logo.webp" */
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

export type SocialLink = { type: string; url: string };

export type SettingsView = {
  phone: string;
  email: string;
  address: string;
  socials: SocialLink[];
  seoTitle: string;
  seoDescription: string;
  ogImage: ImageRef | null;
};

/** Everything the landing page renders, for one locale. */
export type LandingContent = {
  locale: Locale;
  /** Localized ContentBlock texts; "" when a block is missing or empty in every locale. */
  texts: Record<TextKey, string>;
  /** ContentBlock images; null when no media is assigned. */
  images: Record<ImageKey, ImageRef | null>;
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
