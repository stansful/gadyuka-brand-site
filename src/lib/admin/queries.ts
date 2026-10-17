import "server-only";
import type { LeadStatus, LeadType, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { missingLocales, parseLocalizedText, readText } from "@/lib/i18n-text";
import { CONTENT_COPY } from "@/lib/content/default-copy";
import {
  CONTENT_BLOCKS,
  CONTENT_KEYS,
  CONTENT_SECTIONS,
  SECTION_ANCHORS,
  TEXT_KEYS,
  isRequiredKey,
  isTextKey,
  type SectionId,
} from "@/lib/content/registry";
import { parseSocialLinks, SOCIAL_TYPES, type SocialType } from "@/lib/content/schemas";
import { requireAdminPage } from "./auth";
import { countRu, formatRubles } from "./labels";
import { adminMediaRefSelect, listMedia, toMediaRef } from "./media-service";
import { toDateInputValue } from "./schemas";
import type {
  CollectionFormData,
  CollectionOption,
  ContentSectionData,
  EntityRow,
  GalleryFormData,
  LeadDetail,
  LeadListItem,
  MediaPage,
  NewsFormData,
  OfferFormData,
  PartnerFormData,
  ProductFormData,
  ReviewFormData,
  SettingsFormData,
} from "./types";

/**
 * Admin data access layer. EVERY exported function authorizes first
 * (requireAdminPage → redirect to /admin/login), so a page can never read admin
 * data without a session, even if a layout check was skipped.
 * Results are plain serializable view models (src/lib/admin/types.ts).
 */

const ru = "ru" as const;
const refSelect = { select: adminMediaRefSelect } as const;
const listOrder = [{ order: "asc" as const }, { createdAt: "asc" as const }];

// ── dashboard ─────────────────────────────────────────────────────────────────

export type DashboardData = {
  counts: Array<{ label: string; href: string; total: number; published?: number }>;
  leads: { total: number; fresh: number; telegramFailed: number };
  latestLeads: LeadListItem[];
};

export async function getDashboardData(): Promise<DashboardData> {
  await requireAdminPage();
  const [
    collections,
    collectionsPublished,
    products,
    productsPublished,
    reviews,
    reviewsPublished,
    news,
    newsPublished,
    gallery,
    galleryPublished,
    offers,
    offersPublished,
    partners,
    partnersPublished,
    media,
    leadsTotal,
    leadsFresh,
    telegramFailed,
    latest,
  ] = await Promise.all([
    db.collection.count(),
    db.collection.count({ where: { published: true } }),
    db.product.count(),
    db.product.count({ where: { published: true } }),
    db.review.count(),
    db.review.count({ where: { published: true } }),
    db.newsItem.count(),
    db.newsItem.count({ where: { published: true } }),
    db.galleryItem.count(),
    db.galleryItem.count({ where: { published: true } }),
    db.offer.count(),
    db.offer.count({ where: { published: true } }),
    db.partner.count(),
    db.partner.count({ where: { published: true } }),
    db.media.count(),
    db.lead.count(),
    db.lead.count({ where: { status: "NEW" } }),
    db.lead.count({ where: { telegramSent: false, status: { not: "SPAM" } } }),
    db.lead.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: leadListSelect }),
  ]);

  return {
    counts: [
      { label: "Коллекции", href: "/admin/collections", total: collections, published: collectionsPublished },
      { label: "Товары", href: "/admin/products", total: products, published: productsPublished },
      { label: "Отзывы", href: "/admin/reviews", total: reviews, published: reviewsPublished },
      { label: "Новости", href: "/admin/news", total: news, published: newsPublished },
      { label: "Галерея", href: "/admin/gallery", total: gallery, published: galleryPublished },
      { label: "Спецпредложения", href: "/admin/offers", total: offers, published: offersPublished },
      { label: "Партнёры", href: "/admin/partners", total: partners, published: partnersPublished },
      { label: "Медиатека", href: "/admin/media", total: media },
    ],
    leads: { total: leadsTotal, fresh: leadsFresh, telegramFailed },
    latestLeads: latest.map(toLeadListItem),
  };
}

/** Badge in the sidebar. */
export async function getNewLeadCount(): Promise<number> {
  await requireAdminPage();
  return db.lead.count({ where: { status: "NEW" } });
}

// ── content blocks ────────────────────────────────────────────────────────────

export async function getContentSection(section: SectionId): Promise<ContentSectionData> {
  await requireAdminPage();
  const keys = CONTENT_KEYS.filter((key) => CONTENT_BLOCKS[key].section === section);
  const rows = await db.contentBlock.findMany({
    where: { key: { in: [...keys] } },
    select: { key: true, value: true, updatedAt: true, media: refSelect },
  });
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const definition = CONTENT_SECTIONS.find((item) => item.id === section);

  return {
    section,
    label: definition?.label ?? section,
    anchor: SECTION_ANCHORS[section],
    blocks: keys.map((key) => {
      const row = byKey.get(key);
      const block = CONTENT_BLOCKS[key];
      return {
        key,
        label: isRequiredKey(key) ? `${block.label} — обязательно` : block.label,
        kind: block.kind,
        // A key added by a release but not seeded yet: show the default copy the site shows
        // (saving the section then stores it), never an empty field.
        value: !row && isTextKey(key) ? { ...CONTENT_COPY[key] } : parseLocalizedText(row?.value),
        media: toMediaRef(row?.media),
        updatedAt: row ? row.updatedAt.toISOString() : null,
      };
    }),
  };
}

/**
 * Per-section count of text blocks with missing translations (for the section tabs). Only keys
 * of the current registry count — rows of removed keys stay in the DB but are not listed in the
 * admin, so a gap there could never be found or fixed — and they are grouped by the registry's
 * section, like getContentSection lists them.
 */
export async function getContentTranslationGaps(): Promise<Partial<Record<SectionId, number>>> {
  await requireAdminPage();
  const rows = await db.contentBlock.findMany({ where: { key: { in: [...TEXT_KEYS] } }, select: { key: true, value: true } });
  const gaps: Partial<Record<SectionId, number>> = {};
  for (const row of rows) {
    if (!isTextKey(row.key) || missingLocales(row.value).length === 0) continue;
    const section = CONTENT_BLOCKS[row.key].section;
    gaps[section] = (gaps[section] ?? 0) + 1;
  }
  return gaps;
}

// ── collections & products ────────────────────────────────────────────────────

export async function listCollectionsAdmin(): Promise<EntityRow[]> {
  await requireAdminPage();
  const rows = await db.collection.findMany({
    orderBy: listOrder,
    select: { id: true, slug: true, title: true, published: true, cover: refSelect, _count: { select: { products: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    title: readText(row.title, ru) || row.slug,
    subtitle: `/${row.slug}`,
    thumb: toMediaRef(row.cover),
    href: `/admin/collections/${row.id}`,
    published: row.published,
    missingLocales: missingLocales(row.title),
    meta: countRu(row._count.products, "товар", "товара", "товаров"),
    deleteWarning:
      row._count.products > 0
        ? `Вместе с коллекцией будут удалены ${countRu(row._count.products, "товар", "товара", "товаров")}.`
        : undefined,
  }));
}

export async function getCollectionOptions(): Promise<CollectionOption[]> {
  await requireAdminPage();
  const rows = await db.collection.findMany({ orderBy: listOrder, select: { id: true, slug: true, title: true } });
  return rows.map((row) => ({ id: row.id, slug: row.slug, title: readText(row.title, ru) || row.slug }));
}

export async function getCollectionForm(id: string): Promise<CollectionFormData | null> {
  await requireAdminPage();
  const row = await db.collection.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      published: true,
      cover: refSelect,
      _count: { select: { products: true } },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: parseLocalizedText(row.title),
    description: parseLocalizedText(row.description),
    cover: toMediaRef(row.cover),
    published: row.published,
    productCount: row._count.products,
  };
}

export type ProductGroup = { collection: CollectionOption & { published: boolean }; rows: EntityRow[] };

export async function listProductsAdmin(): Promise<ProductGroup[]> {
  await requireAdminPage();
  const collections = await db.collection.findMany({
    orderBy: listOrder,
    select: {
      id: true,
      slug: true,
      title: true,
      published: true,
      products: {
        orderBy: listOrder,
        select: {
          id: true,
          slug: true,
          title: true,
          price: true,
          published: true,
          images: { orderBy: { order: "asc" }, take: 1, select: { media: refSelect } },
          _count: { select: { images: true } },
        },
      },
    },
  });
  return collections.map((collection) => ({
    collection: {
      id: collection.id,
      slug: collection.slug,
      title: readText(collection.title, ru) || collection.slug,
      published: collection.published,
    },
    rows: collection.products.map((product) => ({
      id: product.id,
      title: readText(product.title, ru) || product.slug,
      subtitle: `/${product.slug}`,
      thumb: toMediaRef(product.images[0]?.media),
      href: `/admin/products/${product.id}`,
      published: product.published,
      missingLocales: missingLocales(product.title),
      meta: [
        product.price === null ? "цена по запросу" : formatRubles(product.price),
        countRu(product._count.images, "фото", "фото", "фото"),
      ].join(" · "),
    })),
  }));
}

export async function getProductForm(id: string): Promise<ProductFormData | null> {
  await requireAdminPage();
  const row = await db.product.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      collectionId: true,
      title: true,
      description: true,
      details: true,
      price: true,
      published: true,
      images: { orderBy: { order: "asc" }, select: { media: refSelect } },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    collectionId: row.collectionId,
    title: parseLocalizedText(row.title),
    description: parseLocalizedText(row.description),
    details: parseLocalizedText(row.details),
    price: row.price,
    images: row.images.map((image) => toMediaRef(image.media)),
    published: row.published,
  };
}

// ── reviews ───────────────────────────────────────────────────────────────────

export async function listReviewsAdmin(): Promise<EntityRow[]> {
  await requireAdminPage();
  const rows = await db.review.findMany({
    orderBy: listOrder,
    select: { id: true, author: true, role: true, text: true, rating: true, published: true, avatar: refSelect },
  });
  return rows.map((row) => {
    const text = readText(row.text, ru);
    return {
      id: row.id,
      title: row.author,
      subtitle: text.length > 120 ? `${text.slice(0, 120)}…` : text,
      thumb: toMediaRef(row.avatar),
      href: `/admin/reviews/${row.id}`,
      published: row.published,
      missingLocales: missingLocales(row.text),
      meta: [readText(row.role, ru), row.rating ? `${"★".repeat(row.rating)}` : ""].filter(Boolean).join(" · ") || undefined,
    };
  });
}

export async function getReviewForm(id: string): Promise<ReviewFormData | null> {
  await requireAdminPage();
  const row = await db.review.findUnique({
    where: { id },
    select: { id: true, author: true, role: true, text: true, rating: true, published: true, avatar: refSelect },
  });
  if (!row) return null;
  return {
    id: row.id,
    author: row.author,
    role: parseLocalizedText(row.role),
    text: parseLocalizedText(row.text),
    avatar: toMediaRef(row.avatar),
    rating: row.rating,
    published: row.published,
  };
}

// ── news ──────────────────────────────────────────────────────────────────────

export async function listNewsAdmin(): Promise<EntityRow[]> {
  await requireAdminPage();
  const rows = await db.newsItem.findMany({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: { id: true, slug: true, title: true, date: true, published: true, image: refSelect },
  });
  return rows.map((row) => ({
    id: row.id,
    title: readText(row.title, ru) || row.slug,
    subtitle: `/${row.slug}`,
    thumb: toMediaRef(row.image),
    href: `/admin/news/${row.id}`,
    published: row.published,
    missingLocales: missingLocales(row.title),
    meta: toDateInputValue(row.date).split("-").reverse().join("."),
  }));
}

export async function getNewsForm(id: string): Promise<NewsFormData | null> {
  await requireAdminPage();
  const row = await db.newsItem.findUnique({
    where: { id },
    select: { id: true, slug: true, title: true, excerpt: true, body: true, date: true, published: true, image: refSelect },
  });
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: parseLocalizedText(row.title),
    excerpt: parseLocalizedText(row.excerpt),
    body: parseLocalizedText(row.body),
    date: toDateInputValue(row.date),
    image: toMediaRef(row.image),
    published: row.published,
  };
}

// ── gallery ───────────────────────────────────────────────────────────────────

export async function listGalleryAdmin(): Promise<EntityRow[]> {
  await requireAdminPage();
  const rows = await db.galleryItem.findMany({
    orderBy: listOrder,
    select: { id: true, caption: true, published: true, media: refSelect },
  });
  return rows.map((row) => ({
    id: row.id,
    title: readText(row.caption, ru) || "Без подписи",
    thumb: toMediaRef(row.media),
    href: `/admin/gallery/${row.id}`,
    published: row.published,
    missingLocales: Object.keys(parseLocalizedText(row.caption)).length === 0 ? [] : missingLocales(row.caption),
  }));
}

export async function getGalleryForm(id: string): Promise<GalleryFormData | null> {
  await requireAdminPage();
  const row = await db.galleryItem.findUnique({
    where: { id },
    select: { id: true, caption: true, published: true, media: refSelect },
  });
  if (!row) return null;
  return { id: row.id, media: toMediaRef(row.media), caption: parseLocalizedText(row.caption), published: row.published };
}

// ── offers ────────────────────────────────────────────────────────────────────

export async function listOffersAdmin(): Promise<EntityRow[]> {
  await requireAdminPage();
  const rows = await db.offer.findMany({
    orderBy: listOrder,
    select: { id: true, title: true, badge: true, validUntil: true, published: true, image: refSelect },
  });
  const now = Date.now();
  return rows.map((row) => {
    const until = row.validUntil;
    const expired = until !== null && until.getTime() < now;
    const untilText = until ? `до ${toDateInputValue(until).split("-").reverse().join(".")}` : "бессрочно";
    return {
      id: row.id,
      title: readText(row.title, ru),
      subtitle: readText(row.badge, ru) || undefined,
      thumb: toMediaRef(row.image),
      href: `/admin/offers/${row.id}`,
      published: row.published,
      missingLocales: missingLocales(row.title),
      meta: expired ? `${untilText} — истекло, на сайте не показывается` : untilText,
    };
  });
}

export async function getOfferForm(id: string): Promise<OfferFormData | null> {
  await requireAdminPage();
  const row = await db.offer.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      text: true,
      badge: true,
      ctaLabel: true,
      ctaHref: true,
      validUntil: true,
      published: true,
      image: refSelect,
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    title: parseLocalizedText(row.title),
    text: parseLocalizedText(row.text),
    badge: parseLocalizedText(row.badge),
    ctaLabel: parseLocalizedText(row.ctaLabel),
    ctaHref: row.ctaHref,
    validUntil: row.validUntil ? toDateInputValue(row.validUntil) : null,
    image: toMediaRef(row.image),
    published: row.published,
  };
}

// ── partners ──────────────────────────────────────────────────────────────────

export async function listPartnersAdmin(): Promise<EntityRow[]> {
  await requireAdminPage();
  const rows = await db.partner.findMany({
    orderBy: listOrder,
    select: { id: true, name: true, url: true, description: true, published: true, logo: refSelect },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.name,
    subtitle: row.url ?? undefined,
    thumb: toMediaRef(row.logo),
    href: `/admin/partners/${row.id}`,
    published: row.published,
    missingLocales: Object.keys(parseLocalizedText(row.description)).length === 0 ? [] : missingLocales(row.description),
  }));
}

export async function getPartnerForm(id: string): Promise<PartnerFormData | null> {
  await requireAdminPage();
  const row = await db.partner.findUnique({
    where: { id },
    select: { id: true, name: true, url: true, description: true, published: true, logo: refSelect },
  });
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    logo: toMediaRef(row.logo),
    description: parseLocalizedText(row.description),
    published: row.published,
  };
}

// ── media library ─────────────────────────────────────────────────────────────

export async function getMediaLibrary(query?: string): Promise<MediaPage & { total: number }> {
  await requireAdminPage();
  const [page, total] = await Promise.all([listMedia({ query }), db.media.count()]);
  return { ...page, total };
}

// ── leads ─────────────────────────────────────────────────────────────────────

const leadListSelect = {
  id: true,
  type: true,
  status: true,
  name: true,
  email: true,
  phone: true,
  message: true,
  locale: true,
  telegramSent: true,
  createdAt: true,
} as const satisfies Prisma.LeadSelect;

type LeadListRow = Prisma.LeadGetPayload<{ select: typeof leadListSelect }>;

function toLeadListItem(row: LeadListRow): LeadListItem {
  const message = row.message.replace(/\s+/g, " ").trim();
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    name: row.name,
    email: row.email,
    phone: row.phone,
    preview: message.length > 140 ? `${message.slice(0, 140)}…` : message,
    locale: row.locale,
    telegramSent: row.telegramSent,
    createdAt: row.createdAt.toISOString(),
  };
}

export const LEADS_PAGE_SIZE = 25;

export type LeadFilters = { type: LeadType | null; status: LeadStatus | null; page: number };
export type LeadListPage = { items: LeadListItem[]; total: number; page: number; pageCount: number };

export async function listLeadsAdmin(filters: LeadFilters): Promise<LeadListPage> {
  await requireAdminPage();
  const where: Prisma.LeadWhereInput = {
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };
  const total = await db.lead.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / LEADS_PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page), pageCount);
  const rows = await db.lead.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * LEADS_PAGE_SIZE,
    take: LEADS_PAGE_SIZE,
    select: leadListSelect,
  });
  return { items: rows.map(toLeadListItem), total, page, pageCount };
}

function flattenMeta(value: unknown): Array<{ key: string; value: string }> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return value === null || value === undefined ? [] : [{ key: "meta", value: JSON.stringify(value) }];
  }
  return Object.entries(value)
    .slice(0, 50)
    .map(([key, item]) => ({
      key,
      value: typeof item === "string" ? item : JSON.stringify(item) ?? "",
    }));
}

export async function getLeadDetail(id: string): Promise<LeadDetail | null> {
  await requireAdminPage();
  const row = await db.lead.findUnique({
    where: { id },
    select: { ...leadListSelect, telegramError: true, meta: true, updatedAt: true },
  });
  if (!row) return null;
  return {
    ...toLeadListItem(row),
    message: row.message,
    telegramError: row.telegramError,
    meta: flattenMeta(row.meta),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ── settings ──────────────────────────────────────────────────────────────────

function toSocialType(value: string): SocialType {
  return SOCIAL_TYPES.find((type) => type === value) ?? "other";
}

export async function getSettingsForm(): Promise<SettingsFormData> {
  await requireAdminPage();
  const row = await db.siteSettings.findUnique({
    where: { id: 1 },
    select: {
      phone: true,
      email: true,
      address: true,
      socials: true,
      seoTitle: true,
      seoDescription: true,
      ogImage: refSelect,
    },
  });
  return {
    phone: row?.phone ?? "",
    email: row?.email ?? "",
    address: parseLocalizedText(row?.address),
    socials: parseSocialLinks(row?.socials).map((link) => ({ type: toSocialType(link.type), url: link.url })),
    seoTitle: parseLocalizedText(row?.seoTitle),
    seoDescription: parseLocalizedText(row?.seoDescription),
    ogImage: toMediaRef(row?.ogImage),
  };
}
