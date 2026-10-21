/**
 * Public site content (/api/v1/public/*, every route @Public, cached by the frontend with
 * 'use cache' + cacheTag('content')). Owner: slice S1 (public content reads).
 *
 * Routes:
 * - GET /public/landing/:locale            → LandingResponse (everything the landing renders)
 * - GET /public/messages/:locale           → SiteMessagesResponse (next-intl's messages)
 * - GET /public/collections/:slug?locale=  → PublicCollectionResponse (404 for a missing or hidden one)
 * - GET /public/collections                → PublishedCollectionsResponse (slugs of the published ones)
 * - GET /public/sitemap                    → SitemapResponse (lastmod of every public page)
 * - GET /public/settings/:locale           → PublicSettingsResponse (contacts, review scale, SEO defaults)
 *
 * Everything is already localized for the requested locale: a field without a translation falls
 * back to the default locale (ru), except image alt texts (ImageRef.alt has no fallback).
 */

import type { ImageRef, IsoDateTime, Locale, Uuid } from './common';
import type { SocialType } from './content-entities';

/** A nested message tree as in shared/messages/<locale>.json: branches are objects, leaves strings. */
export interface SiteMessageTree {
  readonly [key: string]: string | SiteMessageTree;
}

/**
 * GET /public/messages/:locale — every site UI message of the locale: the admin's Message rows over
 * the shared/messages defaults (blank ru row → "", blank row of another locale → the ru value,
 * orphan rows ignored). The frontend feeds it to next-intl (src/i18n/site-messages.ts).
 */
export interface SiteMessagesResponse {
  readonly locale: Locale;
  readonly messages: SiteMessageTree;
}

/** A published product of a published collection. */
export interface PublicProduct {
  readonly id: Uuid;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  /** Product.details split into trimmed, non-empty lines */
  readonly details: readonly string[];
  /** Whole rubles; null = price on request */
  readonly price: number | null;
  /** In the admin's order */
  readonly images: readonly ImageRef[];
}

/** A published collection with its published products (ordered, at most 48). */
export interface PublicCollection {
  readonly id: Uuid;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly cover: ImageRef | null;
  readonly products: readonly PublicProduct[];
}

export interface PublicReview {
  readonly id: Uuid;
  readonly author: string;
  readonly role: string;
  readonly text: string;
  readonly avatar: ImageRef | null;
  /** 1..settings.reviewRatingMax (clamped when the scale was lowered later); null = no rating */
  readonly rating: number | null;
}

export interface PublicNewsItem {
  readonly id: Uuid;
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string;
  readonly body: string;
  readonly date: IsoDateTime;
  readonly image: ImageRef | null;
}

export interface PublicGalleryItem {
  readonly id: Uuid;
  readonly caption: string;
  readonly image: ImageRef;
}

export interface PublicOffer {
  readonly id: Uuid;
  readonly title: string;
  readonly text: string;
  /** "" = no badge */
  readonly badge: string;
  /** "" = no button */
  readonly ctaLabel: string;
  readonly ctaHref: string | null;
  /** null = no end date */
  readonly validUntil: IsoDateTime | null;
  readonly image: ImageRef | null;
}

export interface PublicPartner {
  readonly id: Uuid;
  readonly name: string;
  readonly url: string | null;
  readonly description: string;
  readonly logo: ImageRef | null;
}

/** A published menu item (items without a label in any locale are not listed). */
export interface PublicMenuItem {
  readonly id: Uuid;
  readonly label: string;
  /** As stored: "#catalog", "/catalog/<slug>", "https://…", "mailto:", "tel:" */
  readonly href: string;
  readonly showInHeader: boolean;
  readonly showInFooter: boolean;
}

export interface PublicSocialLink {
  readonly id: Uuid;
  readonly type: SocialType;
  readonly url: string;
  /** Own label; null = the site shows its default label (message `social.<type>`) */
  readonly label: string | null;
}

/** SiteSettings for one locale; the defaults below while the settings row does not exist yet. */
export interface PublicSettings {
  /** "" by default */
  readonly phone: string;
  /** "" by default */
  readonly email: string;
  readonly address: string;
  /** Stars of the review rating scale (5 by default) */
  readonly reviewRatingMax: number;
  readonly seoTitle: string;
  readonly seoDescription: string;
  readonly ogImage: ImageRef | null;
}

/**
 * GET /public/landing/:locale — everything the landing renders, localized. Lists hold published
 * rows in the admin's order, bounded: collections 20 (products 48 each), reviews 30 (manual order,
 * newest first on ties), news 12 (newest first), gallery 60, offers 12 (not expired), partners 40,
 * menu 30, social links 20.
 */
export interface LandingResponse {
  readonly locale: Locale;
  /** Every site message of the locale, flat ({ "hero.title": "…" }): the same values as /public/messages */
  readonly texts: Readonly<Record<string, string>>;
  /** Landing images by ContentImage key ("about.image"); a key without a row is absent, a row without media is null */
  readonly images: Readonly<Record<string, ImageRef | null>>;
  readonly menu: readonly PublicMenuItem[];
  readonly socials: readonly PublicSocialLink[];
  readonly collections: readonly PublicCollection[];
  readonly reviews: readonly PublicReview[];
  readonly news: readonly PublicNewsItem[];
  readonly gallery: readonly PublicGalleryItem[];
  /** Published offers whose validUntil is not in the past */
  readonly offers: readonly PublicOffer[];
  readonly partners: readonly PublicPartner[];
  readonly settings: PublicSettings;
  /**
   * The earliest validUntil among `offers` (null when none of them ends): the landing changes by
   * itself at that moment, so a cache must not keep this answer beyond it.
   */
  readonly offersExpireAt: IsoDateTime | null;
}

/** GET /public/collections/:slug?locale= — one published collection (404 when missing or hidden). */
export interface PublicCollectionResponse {
  readonly locale: Locale;
  readonly collection: PublicCollection;
}

/** GET /public/collections — slugs of the published collections, in the admin's order (at most 200). */
export interface PublishedCollectionsResponse {
  readonly slugs: readonly string[];
}

/** One collection page of the sitemap. */
export interface SitemapCollection {
  readonly slug: string;
  /** The latest change of anything the collection page renders */
  readonly lastModified: IsoDateTime;
}

/**
 * GET /public/sitemap — lastmod of the public pages: the latest updatedAt of the rows a page
 * renders (hidden rows count too: hiding one changes the pages). Every page renders the site
 * messages, the menu, the social links and the settings; the landing also its images, the media,
 * every section and collection; a collection page its collection, cover, products and their images.
 */
export interface SitemapResponse {
  /** null on an empty database */
  readonly landingLastModified: IsoDateTime | null;
  /** Published collections in the admin's order (at most 200) */
  readonly collections: readonly SitemapCollection[];
}

/** GET /public/settings/:locale — the site settings (contacts, review scale, SEO defaults). */
export interface PublicSettingsResponse {
  readonly locale: Locale;
  readonly settings: PublicSettings;
}
