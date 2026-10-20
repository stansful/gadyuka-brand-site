import type { LeadStatus, LeadType } from '@/generated/prisma/enums';
import type { Locale } from '@/i18n/locales';
import type { MessageKey } from '@/i18n/messages';
import type { ImageKey, MessageKind } from '@/lib/content/registry';
import type { SocialType } from '@/lib/content/social';
import type { LocalizedText } from '@/lib/i18n-text';

import type { ActionResult } from './action-result';

/**
 * Serializable view models passed from admin Server Components to client components
 * (isomorphic, no Prisma runtime). Dates are ISO strings, translatable fields are
 * LocalizedText, media references carry what a thumbnail needs.
 */

/** Enough of a Media row to render a thumbnail / picker preview. */
export type AdminMediaRef = {
  id: string;
  /** Public link of the file ("/media/…", Media.url) */
  url: string;
  width: number;
  height: number;
  alt: LocalizedText;
};

export type AdminMedia = AdminMediaRef & {
  mime: string;
  /** Bytes */
  size: number;
  originalName: string | null;
  /** ISO 8601 */
  createdAt: string;
  /** Number of places that reference this file (0 = safe to delete). */
  usageCount: number;
};

export type MediaUsage = {
  /** What references the file (admin.media.usages), e.g. «Фото товара», «Картинка лендинга». */
  kind: string;
  title: string;
  href: string;
};

export type MediaPage = { items: AdminMedia[]; nextCursor: string | null };

/** deleteMedia(): blocked deletes carry the places that still use the file. */
export type DeleteMediaResult = ActionResult | { ok: false; error: string; usages: MediaUsage[] };

/** Row of a generic admin list (collections, products, reviews, …). */
export type EntityRow = {
  id: string;
  title: string;
  subtitle?: string;
  thumb: AdminMediaRef | null;
  href: string;
  published: boolean;
  /** Locales whose main text is not translated yet. */
  missingLocales: Locale[];
  /** Small grey note (e.g. «4 товара», «до 31.10.2026»). */
  meta?: string;
  /** Extra confirmation text shown before deleting. */
  deleteWarning?: string;
};

export type CollectionFormData = {
  id: string;
  slug: string;
  title: LocalizedText;
  description: LocalizedText;
  cover: AdminMediaRef | null;
  published: boolean;
  productCount: number;
};

export type CollectionOption = { id: string; slug: string; title: string };

export type ProductFormData = {
  id: string;
  slug: string;
  collectionId: string;
  title: LocalizedText;
  description: LocalizedText;
  details: LocalizedText;
  price: number | null;
  images: AdminMediaRef[];
  published: boolean;
};

export type ReviewFormData = {
  id: string;
  author: string;
  role: LocalizedText;
  text: LocalizedText;
  avatar: AdminMediaRef | null;
  rating: number | null;
  published: boolean;
};

export type NewsFormData = {
  id: string;
  slug: string;
  title: LocalizedText;
  excerpt: LocalizedText;
  body: LocalizedText;
  /** "YYYY-MM-DD" (Moscow) */
  date: string;
  image: AdminMediaRef | null;
  published: boolean;
};

export type GalleryFormData = {
  id: string;
  media: AdminMediaRef;
  caption: LocalizedText;
  published: boolean;
};

export type OfferFormData = {
  id: string;
  title: LocalizedText;
  text: LocalizedText;
  badge: LocalizedText;
  ctaLabel: LocalizedText;
  ctaHref: string | null;
  /** "YYYY-MM-DD" (Moscow) or null */
  validUntil: string | null;
  image: AdminMediaRef | null;
  published: boolean;
};

export type PartnerFormData = {
  id: string;
  name: string;
  url: string | null;
  logo: AdminMediaRef | null;
  description: LocalizedText;
  published: boolean;
};

export type SettingsFormData = {
  phone: string;
  email: string;
  address: LocalizedText;
  /** Max stars of a review rating (1..10). */
  reviewRatingMax: number;
  seoTitle: LocalizedText;
  seoDescription: LocalizedText;
  ogImage: AdminMediaRef | null;
};

export type MenuItemFormData = {
  id: string;
  label: LocalizedText;
  href: string;
  showInHeader: boolean;
  showInFooter: boolean;
  published: boolean;
};

/** Suggested link targets of the menu form (landing anchors, collection pages). */
export type MenuHrefOption = { href: string; label: string };

export type SocialLinkFormData = {
  id: string;
  type: SocialType;
  url: string;
  /** Own label; empty = the site's default name of the type (message `social.<TYPE>`). */
  label: LocalizedText;
  published: boolean;
};

// ── «Тексты сайта» (Message rows) ────────────────────────────────────────────

/** One site text (a Message key) in the editor. */
export type SiteTextEntry = {
  key: MessageKey;
  /** Russian admin label (admin.siteTexts.labels), the key without its namespace when there is none. */
  label: string;
  kind: MessageKind;
  /** The Russian text must not be empty (headings, buttons, links). */
  required: boolean;
  /** What the site shows: the DB value, or the default when the row is missing. */
  values: Record<Locale, string>;
  /** messages/<locale>.json — what «Вернуть по умолчанию» restores. */
  defaults: Record<Locale, string>;
  /** ISO 8601 Message.editedAt of the locales edited in the admin (no entry = default text). */
  edited: Partial<Record<Locale, string>>;
  /** Locales without a DB row yet (the site shows the default; saving stores it). */
  missing: Locale[];
  /** {arguments} and <tags> of the default (the code fills them in — they must stay). */
  placeholders: string[];
  tags: string[];
};

/** A landing image (ContentImage row) edited next to the texts of its section. */
export type SiteImageEntry = {
  key: ImageKey;
  label: string;
  media: AdminMediaRef | null;
};

/** A group of texts in the editor: one section, or the matches of a search in one section. */
export type SiteTextGroup = {
  /** Section id = top-level namespace of the messages ("hero", "forms", …). */
  section: string;
  label: string;
  /** In-page anchor of the section on the landing (null when not on the landing). */
  anchor: string | null;
  entries: SiteTextEntry[];
  images: SiteImageEntry[];
};

/** Tab of the «Тексты сайта» section bar. */
export type SiteTextSectionSummary = {
  id: string;
  label: string;
  /** Number of texts in the section. */
  total: number;
  /** Texts edited in the admin (any locale). */
  edited: number;
  /** Texts with an empty translation in some non-default locale (the site shows Russian there). */
  gaps: number;
  /** Texts with a missing DB row in some locale (seed not run yet; the default is shown). */
  unsaved: number;
};

export type SiteTextsPageData = {
  sections: SiteTextSectionSummary[];
  /** "section" = one section with its images; "search" = matches of `query` across sections. */
  mode: 'section' | 'search';
  /** Active section in "section" mode. */
  section: string | null;
  /** Normalized search query in "search" mode. */
  query: string;
  groups: SiteTextGroup[];
};

export type LeadListItem = {
  id: string;
  type: LeadType;
  status: LeadStatus;
  name: string;
  email: string | null;
  phone: string | null;
  /** First ~140 characters of the message */
  preview: string;
  locale: string;
  telegramSent: boolean;
  createdAt: string;
};

export type LeadDetail = LeadListItem & {
  message: string;
  telegramError: string | null;
  meta: Array<{ key: string; value: string }>;
  updatedAt: string;
};
