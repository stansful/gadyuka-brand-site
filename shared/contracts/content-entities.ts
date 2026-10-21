/**
 * Admin content entities (owner: slice S4b): news, gallery (+ bulk add), offers, partners, menu items
 * and social links. Publish / reorder / delete of these rows: ./entities.ts. Every route needs a
 * signed-in ADMIN.
 *
 * - GET  /admin/news                             → AdminNewsListResponse (date desc, then newest first)
 * - GET  /admin/news/:id                         → AdminNewsDetails
 * - POST /admin/news                 AdminNewsInput   → 201 ContentEntitySaved
 * - PUT  /admin/news/:id             AdminNewsInput   → 200 ContentEntitySaved
 * - GET  /admin/gallery                          → AdminGalleryListResponse (manual order)
 * - GET  /admin/gallery/:id                      → AdminGalleryItemDetails
 * - POST /admin/gallery              AdminGalleryItemInput → 201 ContentEntitySaved (appended at the end)
 * - PUT  /admin/gallery/:id          AdminGalleryItemInput → 200 ContentEntitySaved
 * - POST /admin/gallery/bulk         AdminGalleryBulkInput → 201 AdminGalleryBulkAdded (appended, no captions)
 * - GET  /admin/offers · GET /admin/offers/:id · POST /admin/offers · PUT /admin/offers/:id   (AdminOfferInput)
 * - GET  /admin/partners · GET /admin/partners/:id · POST /admin/partners · PUT /admin/partners/:id (AdminPartnerInput)
 * - GET  /admin/menu-items · GET /admin/menu-items/:id · POST /admin/menu-items · PUT /admin/menu-items/:id
 *   (AdminMenuItemInput) · GET /admin/menu-items/link-targets → AdminMenuLinkTargetsResponse
 * - GET  /admin/social-links · GET /admin/social-links/:id · POST /admin/social-links ·
 *   PUT /admin/social-links/:id (AdminSocialLinkInput) · GET /admin/social-links/default-labels → AdminSocialDefaultLabelsResponse
 *
 * Lists answer every row (at most 1000) in the order the admin list shows them. New rows of the
 * ordered entities go to the end of their list.
 *
 * Errors:
 * - 400 validation: `fields` keyed by dotted paths ("slug", "title.en", "mediaIds") with admin.validation.*
 *   keys (+ values: tooLong {max}, requiredText {locale}, photosBulkTooMany {max});
 * - 400 badRequest: admin.errors.invalidId (malformed :id), admin.errors.missingMedia (a picked media file
 *   no longer exists), admin.offers.ctaHrefRequired (a button label without a button link);
 * - 409 conflict: admin.errors.slugTaken (another news item has the slug), admin.errors.duplicate /
 *   admin.errors.related (concurrent writes);
 * - 404 notFound: admin.errors.notFound (no such row).
 */

import type { LocalizedText, MediaRef, Uuid } from './common';

/** "YYYY-MM-DD": a calendar day in Moscow time (the site's time zone), as <input type="date"> holds it. */
export type CalendarDay = string;

/** Social / messenger networks of SocialLink rows (admin display order). */
export type SocialType =
  | 'TELEGRAM'
  | 'VK'
  | 'INSTAGRAM'
  | 'WHATSAPP'
  | 'YOUTUBE'
  | 'TIKTOK'
  | 'PINTEREST'
  | 'WEBSITE'
  | 'OTHER';

/** Answer of every create / update: the id of the saved row. */
export interface ContentEntitySaved {
  readonly id: Uuid;
}

// ── news ──────────────────────────────────────────────────────────────────────

/**
 * POST /admin/news, PUT /admin/news/:id. Texts are trimmed, empty translations dropped; the slug is
 * trimmed and lowercased; `date` is stored as noon Moscow time of that day.
 */
export interface AdminNewsInput {
  /** 1…120 characters: latin letters, digits, single hyphens; unique among the news */
  readonly slug: string;
  /** Russian required; each translation ≤ 200 */
  readonly title: LocalizedText;
  /** each translation ≤ 1000 */
  readonly excerpt: LocalizedText;
  /** each translation ≤ 20000 */
  readonly body: LocalizedText;
  readonly date: CalendarDay;
  readonly imageId: Uuid | null;
  readonly published: boolean;
}

export interface AdminNewsDetails {
  readonly id: Uuid;
  readonly slug: string;
  readonly title: LocalizedText;
  readonly excerpt: LocalizedText;
  readonly body: LocalizedText;
  readonly date: CalendarDay;
  readonly image: MediaRef | null;
  readonly published: boolean;
}

export interface AdminNewsListItem {
  readonly id: Uuid;
  readonly slug: string;
  readonly title: LocalizedText;
  readonly date: CalendarDay;
  readonly image: MediaRef | null;
  readonly published: boolean;
}

export interface AdminNewsListResponse {
  readonly items: readonly AdminNewsListItem[];
}

// ── gallery ───────────────────────────────────────────────────────────────────

/** POST /admin/gallery, PUT /admin/gallery/:id */
export interface AdminGalleryItemInput {
  readonly mediaId: Uuid;
  /** each translation ≤ 300 */
  readonly caption: LocalizedText;
  readonly published: boolean;
}

/** POST /admin/gallery/bulk — 1…100 different media files, appended in this order without captions. */
export interface AdminGalleryBulkInput {
  readonly mediaIds: readonly Uuid[];
  readonly published: boolean;
}

export interface AdminGalleryBulkAdded {
  /** Items created */
  readonly count: number;
}

/** A gallery item (list rows and the edit form). */
export interface AdminGalleryItemDetails {
  readonly id: Uuid;
  readonly media: MediaRef;
  readonly caption: LocalizedText;
  readonly published: boolean;
}

export interface AdminGalleryListResponse {
  readonly items: readonly AdminGalleryItemDetails[];
}

// ── offers ────────────────────────────────────────────────────────────────────

/** POST /admin/offers, PUT /admin/offers/:id */
export interface AdminOfferInput {
  /** Russian required; each translation ≤ 200 */
  readonly title: LocalizedText;
  /** each translation ≤ 3000 */
  readonly text: LocalizedText;
  /** each translation ≤ 40; empty = no badge */
  readonly badge: LocalizedText;
  /** each translation ≤ 60; empty = no button (a label needs `ctaHref`) */
  readonly ctaLabel: LocalizedText;
  /** ≤ 500 after trimming: https://…, /path, #anchor, mailto:, tel: */
  readonly ctaHref: string | null;
  /** The last day of the offer (inclusive, until 23:59:59.999 Moscow time); null = no end */
  readonly validUntil: CalendarDay | null;
  readonly imageId: Uuid | null;
  readonly published: boolean;
}

export interface AdminOfferDetails {
  readonly id: Uuid;
  readonly title: LocalizedText;
  readonly text: LocalizedText;
  readonly badge: LocalizedText;
  readonly ctaLabel: LocalizedText;
  readonly ctaHref: string | null;
  readonly validUntil: CalendarDay | null;
  readonly image: MediaRef | null;
  readonly published: boolean;
}

export interface AdminOfferListItem {
  readonly id: Uuid;
  readonly title: LocalizedText;
  readonly badge: LocalizedText;
  readonly validUntil: CalendarDay | null;
  /** The last day is over: the site no longer shows the offer */
  readonly expired: boolean;
  readonly image: MediaRef | null;
  readonly published: boolean;
}

export interface AdminOfferListResponse {
  readonly items: readonly AdminOfferListItem[];
}

// ── partners ──────────────────────────────────────────────────────────────────

/** POST /admin/partners, PUT /admin/partners/:id */
export interface AdminPartnerInput {
  /** 1…120 characters after trimming, the same in every language */
  readonly name: string;
  /** http(s) link, ≤ 500; null = no link */
  readonly url: string | null;
  readonly logoId: Uuid | null;
  /** each translation ≤ 3000 */
  readonly description: LocalizedText;
  readonly published: boolean;
}

/** A partner (list rows and the edit form). */
export interface AdminPartnerDetails {
  readonly id: Uuid;
  readonly name: string;
  readonly url: string | null;
  readonly logo: MediaRef | null;
  readonly description: LocalizedText;
  readonly published: boolean;
}

export interface AdminPartnerListResponse {
  readonly items: readonly AdminPartnerDetails[];
}

// ── menu items ────────────────────────────────────────────────────────────────

/** POST /admin/menu-items, PUT /admin/menu-items/:id */
export interface AdminMenuItemInput {
  /** Russian required; each translation ≤ 80 */
  readonly label: LocalizedText;
  /** ≤ 500 after trimming: #anchor (not a bare "#"), /path, https://…, mailto:, tel: */
  readonly href: string;
  readonly showInHeader: boolean;
  readonly showInFooter: boolean;
  readonly published: boolean;
}

/** A menu item (list rows and the edit form). */
export interface AdminMenuItemDetails {
  readonly id: Uuid;
  readonly label: LocalizedText;
  readonly href: string;
  readonly showInHeader: boolean;
  readonly showInFooter: boolean;
  readonly published: boolean;
}

export interface AdminMenuItemListResponse {
  readonly items: readonly AdminMenuItemDetails[];
}

/** A collection page the menu form suggests as a link target ("/catalog/<slug>"). */
export interface AdminMenuCollectionTarget {
  readonly slug: string;
  readonly title: LocalizedText;
}

/** GET /admin/menu-items/link-targets — every collection (published or not), in the catalog order. */
export interface AdminMenuLinkTargetsResponse {
  readonly collections: readonly AdminMenuCollectionTarget[];
}

// ── social links ──────────────────────────────────────────────────────────────

/** POST /admin/social-links, PUT /admin/social-links/:id */
export interface AdminSocialLinkInput {
  readonly type: SocialType;
  /** http(s) link, ≤ 500 */
  readonly url: string;
  /** each translation ≤ 60; empty = the site's default name of the type (message `social.<TYPE>`) */
  readonly label: LocalizedText;
  readonly published: boolean;
}

export interface AdminSocialLinkDetails {
  readonly id: Uuid;
  readonly type: SocialType;
  readonly url: string;
  readonly label: LocalizedText;
  readonly published: boolean;
}

export interface AdminSocialLinkListItem extends AdminSocialLinkDetails {
  /** A placeholder link without a profile ("https://t.me/"): left out of the site's search data */
  readonly bareUrl: boolean;
}

export interface AdminSocialLinkListResponse {
  readonly items: readonly AdminSocialLinkListItem[];
}

/**
 * GET /admin/social-links/default-labels — what the site shows for a link without its own label:
 * the site message `social.<TYPE>` of every locale (admin edits over the shared/messages defaults).
 */
export interface AdminSocialDefaultLabelsResponse {
  readonly labels: Readonly<Record<SocialType, LocalizedText>>;
}
