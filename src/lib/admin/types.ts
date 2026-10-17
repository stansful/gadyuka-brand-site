import type { LeadStatus, LeadType } from "@/generated/prisma/enums";
import type { ActionResult } from "./action-result";
import type { Locale } from "@/i18n/locales";
import type { LocalizedText } from "@/lib/i18n-text";
import type { ContentKey, SectionId } from "@/lib/content/registry";
import type { SocialType } from "@/lib/content/schemas";

/**
 * Serializable view models passed from admin Server Components to client components
 * (isomorphic, no Prisma runtime). Dates are ISO strings, translatable fields are
 * LocalizedText, media references carry what a thumbnail needs.
 */

/** Enough of a Media row to render a thumbnail / picker preview. */
export type AdminMediaRef = {
  id: string;
  /** "/uploads/…" */
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
  /** Russian description, e.g. «Товар», «Контент: Главная» */
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
  socials: Array<{ type: SocialType; url: string }>;
  seoTitle: LocalizedText;
  seoDescription: LocalizedText;
  ogImage: AdminMediaRef | null;
};

export type ContentBlockFormData = {
  key: ContentKey;
  label: string;
  kind: "TEXT" | "RICHTEXT" | "IMAGE" | "LINK";
  value: LocalizedText;
  media: AdminMediaRef | null;
  /** ISO 8601, null when the block is not in the DB yet */
  updatedAt: string | null;
};

export type ContentSectionData = {
  section: SectionId;
  label: string;
  /** In-page anchor on the site (null for header/footer). */
  anchor: string | null;
  blocks: ContentBlockFormData[];
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
