import 'server-only';
import type { LeadStatus, LeadType, Prisma } from '@/generated/prisma/client';
import { locales } from '@/i18n/locales';
import { MESSAGE_KEYS, isMessageKey } from '@/i18n/messages';
import { LEAD_FORM_ANCHOR, SECTION_ANCHORS } from '@/lib/content/registry';
import { SOCIAL_TYPES, type SocialType } from '@/lib/content/social';
import { db } from '@/lib/db';
import { missingLocales, parseLocalizedText, readText, type LocalizedText } from '@/lib/i18n-text';

import type {
  CollectionFormData,
  CollectionOption,
  EntityRow,
  GalleryFormData,
  LeadDetail,
  LeadListItem,
  MediaPage,
  MenuHrefOption,
  MenuItemFormData,
  NewsFormData,
  OfferFormData,
  PartnerFormData,
  ProductFormData,
  ReviewFormData,
  SettingsFormData,
  SiteImageEntry,
  SiteTextGroup,
  SiteTextsPageData,
  SocialLinkFormData,
} from './types';

import { requireAdminPage } from './auth';
import { getAdminTranslations } from './i18n-server';
import { formatRubles, formatStars } from './labels';
import { adminMediaRefSelect, listMedia, toMediaRef } from './media-service';
import { DEFAULT_REVIEW_RATING_MAX, toDateInputValue } from './schemas';
import {
  buildSiteTextEntries,
  hasTranslationGap,
  isEditedEntry,
  matchesSiteTextQuery,
  normalizeSiteTextQuery,
  siteImageKeysOf,
  siteTextLabels,
  siteTextSectionAnchor,
  siteTextSectionOf,
  siteTextSections,
  summarizeSiteTextSections,
  type SiteTextLabels,
} from './site-texts';

/**
 * Admin data access layer. EVERY exported function authorizes first
 * (requireAdminPage → redirect to /admin/login), so a page can never read admin
 * data without a session, even if a layout check was skipped.
 * Results are plain serializable view models (src/lib/admin/types.ts); their texts (labels,
 * notes) come from messages/admin/ru.json.
 */

const ru = 'ru' as const;
const refSelect = { select: adminMediaRefSelect } as const;
const listOrder = [{ order: 'asc' as const }, { createdAt: 'asc' as const }];

// ── dashboard ─────────────────────────────────────────────────────────────────

export type DashboardData = {
  counts: Array<{ label: string; href: string; total: number; published?: number; note?: string }>;
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
    menuItems,
    menuItemsPublished,
    socialLinks,
    socialLinksPublished,
    messages,
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
    db.menuItem.count(),
    db.menuItem.count({ where: { published: true } }),
    db.socialLink.count(),
    db.socialLink.count({ where: { published: true } }),
    loadMessages(),
    db.media.count(),
    db.lead.count(),
    db.lead.count({ where: { status: 'NEW' } }),
    db.lead.count({ where: { telegramSent: false, status: { not: 'SPAM' } } }),
    db.lead.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: leadListSelect }),
  ]);

  const [nav, t, labels] = await Promise.all([
    getAdminTranslations('admin.nav.items'),
    getAdminTranslations('admin.dashboard'),
    loadSiteTextLabels(),
  ]);
  const texts = buildSiteTextEntries(MESSAGE_KEYS, messages, labels);
  const textsEdited = texts.filter(isEditedEntry).length;
  const textsGaps = texts.filter(hasTranslationGap).length;
  const textsUnsaved = texts.filter(entry => entry.missing.length > 0).length;

  return {
    counts: [
      {
        label: nav('content'),
        href: '/admin/content',
        total: texts.length,
        note: [
          t('textsEdited', { count: textsEdited }),
          textsGaps > 0 ? t('textsGaps', { count: textsGaps }) : '',
          textsUnsaved > 0 ? t('textsUnsaved', { count: textsUnsaved }) : '',
        ]
          .filter(Boolean)
          .join(' · '),
      },
      { label: nav('menu'), href: '/admin/menu', total: menuItems, published: menuItemsPublished },
      { label: nav('socials'), href: '/admin/socials', total: socialLinks, published: socialLinksPublished },
      { label: nav('collections'), href: '/admin/collections', total: collections, published: collectionsPublished },
      { label: nav('products'), href: '/admin/products', total: products, published: productsPublished },
      { label: nav('reviews'), href: '/admin/reviews', total: reviews, published: reviewsPublished },
      { label: nav('news'), href: '/admin/news', total: news, published: newsPublished },
      { label: nav('gallery'), href: '/admin/gallery', total: gallery, published: galleryPublished },
      { label: nav('offers'), href: '/admin/offers', total: offers, published: offersPublished },
      { label: nav('partners'), href: '/admin/partners', total: partners, published: partnersPublished },
      { label: nav('media'), href: '/admin/media', total: media },
    ],
    leads: { total: leadsTotal, fresh: leadsFresh, telegramFailed },
    latestLeads: latest.map(toLeadListItem),
  };
}

/** Badge in the sidebar. */
export async function getNewLeadCount(): Promise<number> {
  await requireAdminPage();
  return db.lead.count({ where: { status: 'NEW' } });
}

// ── site texts (Message) & landing images (ContentImage) ────────────────────────

/** Admin names of the sections, texts and landing images (messages/admin/ru.json). */
async function loadSiteTextLabels(): Promise<SiteTextLabels> {
  return siteTextLabels(await getAdminTranslations('admin.siteTexts'));
}

/** Every Message row of the configured locales (≈ keys × locales — a few hundred rows). */
function loadMessages() {
  return db.message.findMany({
    where: { locale: { in: [...locales] } },
    select: { key: true, locale: true, value: true, editedAt: true },
  });
}

async function loadSiteImages(section: string, labels: SiteTextLabels): Promise<SiteImageEntry[]> {
  const keys = siteImageKeysOf(section);
  if (keys.length === 0) return [];
  const rows = await db.contentImage.findMany({
    where: { key: { in: keys } },
    select: { key: true, media: refSelect },
  });
  const byKey = new Map(rows.map(row => [row.key, row]));
  return keys.map(key => ({ key, label: labels.image(key), media: toMediaRef(byKey.get(key)?.media) }));
}

/**
 * «Тексты сайта»: the section tabs with their counters, plus either one section (its texts in
 * messages/ru.json order and its landing images) or — with a non-empty `query` — the texts of
 * every section that match the query (key, label, current or default value).
 * An unknown `section` falls back to «Главная (обложка)» (or the first section).
 */
export async function getSiteTextsPage(params: { section: string | null; query: string }): Promise<SiteTextsPageData> {
  await requireAdminPage();
  const labels = await loadSiteTextLabels();
  const sectionList = siteTextSections(MESSAGE_KEYS, labels);
  const query = normalizeSiteTextQuery(params.query);
  const current =
    query === ''
      ? (sectionList.find(section => section.id === params.section) ??
        sectionList.find(section => section.id === 'hero') ??
        sectionList[0])
      : undefined;
  const [rows, images] = await Promise.all([loadMessages(), current ? loadSiteImages(current.id, labels) : []]);
  const entries = buildSiteTextEntries(MESSAGE_KEYS, rows, labels);
  const sections = summarizeSiteTextSections(sectionList, entries);

  if (query !== '') {
    const groups: SiteTextGroup[] = sectionList.flatMap(section => {
      const matches = entries.filter(
        entry => siteTextSectionOf(entry.key) === section.id && matchesSiteTextQuery(entry, query),
      );
      if (matches.length === 0) return [];
      const group: SiteTextGroup = {
        section: section.id,
        label: section.label,
        anchor: siteTextSectionAnchor(section.id),
        entries: matches,
        images: [],
      };
      return [group];
    });
    return { sections, mode: 'search', section: null, query, groups };
  }

  if (!current) return { sections, mode: 'section', section: null, query: '', groups: [] };
  return {
    sections,
    mode: 'section',
    section: current.id,
    query: '',
    groups: [
      {
        section: current.id,
        label: current.label,
        anchor: siteTextSectionAnchor(current.id),
        entries: entries.filter(entry => siteTextSectionOf(entry.key) === current.id),
        images,
      },
    ],
  };
}

// ── menu & social links ───────────────────────────────────────────────────────

export async function listMenuItemsAdmin(): Promise<EntityRow[]> {
  await requireAdminPage();
  const [rows, t] = await Promise.all([
    db.menuItem.findMany({
      orderBy: listOrder,
      select: { id: true, label: true, href: true, showInHeader: true, showInFooter: true, published: true },
    }),
    getAdminTranslations('admin.menu.placement'),
  ]);
  /** «в шапке · в подвале» */
  const menuPlacement = (row: { showInHeader: boolean; showInFooter: boolean }): string => {
    const places = [row.showInHeader ? t('header') : '', row.showInFooter ? t('footer') : ''].filter(Boolean);
    return places.length > 0 ? places.join(' · ') : t('none');
  };
  return rows.map(row => ({
    id: row.id,
    title: readText(row.label, ru) || row.href,
    subtitle: row.href,
    thumb: null,
    href: `/admin/menu/${row.id}`,
    published: row.published,
    missingLocales: missingLocales(row.label),
    meta: menuPlacement(row),
  }));
}

export async function getMenuItemForm(id: string): Promise<MenuItemFormData | null> {
  await requireAdminPage();
  const row = await db.menuItem.findUnique({
    where: { id },
    select: { id: true, label: true, href: true, showInHeader: true, showInFooter: true, published: true },
  });
  if (!row) return null;
  return {
    id: row.id,
    label: parseLocalizedText(row.label),
    href: row.href,
    showInHeader: row.showInHeader,
    showInFooter: row.showInFooter,
    published: row.published,
  };
}

/**
 * Link suggestions of the menu form: every landing anchor (named like its «Тексты сайта»
 * section), the lead form, then every collection page.
 */
export async function getMenuHrefOptions(): Promise<MenuHrefOption[]> {
  await requireAdminPage();
  const [collections, labels, t] = await Promise.all([
    db.collection.findMany({ orderBy: listOrder, select: { slug: true, title: true } }),
    loadSiteTextLabels(),
    getAdminTranslations('admin.menu.hrefOptions'),
  ]);
  const anchors = Object.entries(SECTION_ANCHORS).flatMap(([section, anchor]): MenuHrefOption[] =>
    anchor ? [{ href: `#${anchor}`, label: labels.section(section) }] : [],
  );
  return [
    ...anchors,
    { href: `#${LEAD_FORM_ANCHOR}`, label: t('leadForm') },
    ...collections.map(collection => ({
      href: `/catalog/${collection.slug}`,
      label: t('collection', { title: readText(collection.title, ru) || collection.slug }),
    })),
  ];
}

/** True for a profile link without a profile («https://t.me/» — the seed placeholder). */
function isBareUrl(url: string): boolean {
  try {
    return new URL(url).pathname.replace(/\/+$/, '') === '';
  } catch {
    return false;
  }
}

export async function listSocialLinksAdmin(): Promise<EntityRow[]> {
  await requireAdminPage();
  const [rows, t] = await Promise.all([
    db.socialLink.findMany({
      orderBy: listOrder,
      select: { id: true, type: true, label: true, url: true, published: true },
    }),
    getAdminTranslations('admin.socials'),
  ]);
  return rows.map(row => {
    const label = parseLocalizedText(row.label);
    const hasOwnLabel = Object.keys(label).length > 0;
    const typeLabel = t(`types.${row.type}`);
    return {
      id: row.id,
      title: readText(label, ru) || typeLabel,
      subtitle: row.url,
      thumb: null,
      href: `/admin/socials/${row.id}`,
      published: row.published,
      missingLocales: hasOwnLabel ? missingLocales(label) : [],
      meta: [hasOwnLabel ? typeLabel : t('defaultLabel'), isBareUrl(row.url) ? t('bareUrl') : '']
        .filter(Boolean)
        .join(' · '),
    };
  });
}

/**
 * The site's own label of each social type — the «Тексты сайта» value of `social.<TYPE>`
 * (DB row, else the default), shown when a link has no label of its own.
 */
export async function getSocialDefaultLabels(): Promise<Record<SocialType, LocalizedText>> {
  await requireAdminPage();
  const keys = SOCIAL_TYPES.map(type => `social.${type}`).filter(isMessageKey);
  const rows = await db.message.findMany({
    where: { key: { in: keys }, locale: { in: [...locales] } },
    select: { key: true, locale: true, value: true, editedAt: true },
  });
  const byKey = new Map<string, LocalizedText>(
    buildSiteTextEntries(keys, rows, await loadSiteTextLabels()).map(entry => [entry.key, entry.values]),
  );
  const out: Partial<Record<SocialType, LocalizedText>> = {};
  for (const type of SOCIAL_TYPES) out[type] = byKey.get(`social.${type}`) ?? {};
  // Every type was assigned above.
  return out as Record<SocialType, LocalizedText>;
}

export async function getSocialLinkForm(id: string): Promise<SocialLinkFormData | null> {
  await requireAdminPage();
  const row = await db.socialLink.findUnique({
    where: { id },
    select: { id: true, type: true, label: true, url: true, published: true },
  });
  if (!row) return null;
  return { id: row.id, type: row.type, url: row.url, label: parseLocalizedText(row.label), published: row.published };
}

// ── collections & products ────────────────────────────────────────────────────

export async function listCollectionsAdmin(): Promise<EntityRow[]> {
  await requireAdminPage();
  const [rows, t, tCommon] = await Promise.all([
    db.collection.findMany({
      orderBy: listOrder,
      select: {
        id: true,
        slug: true,
        title: true,
        published: true,
        cover: refSelect,
        _count: { select: { products: true } },
      },
    }),
    getAdminTranslations('admin.collections'),
    getAdminTranslations('admin.common'),
  ]);
  return rows.map(row => ({
    id: row.id,
    title: readText(row.title, ru) || row.slug,
    subtitle: `/${row.slug}`,
    thumb: toMediaRef(row.cover),
    href: `/admin/collections/${row.id}`,
    published: row.published,
    missingLocales: missingLocales(row.title),
    meta: tCommon('products', { count: row._count.products }),
    deleteWarning: row._count.products > 0 ? t('deleteWarning', { count: row._count.products }) : undefined,
  }));
}

export async function getCollectionOptions(): Promise<CollectionOption[]> {
  await requireAdminPage();
  const rows = await db.collection.findMany({ orderBy: listOrder, select: { id: true, slug: true, title: true } });
  return rows.map(row => ({ id: row.id, slug: row.slug, title: readText(row.title, ru) || row.slug }));
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
  const t = await getAdminTranslations('admin.products');
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
          images: { orderBy: { order: 'asc' }, take: 1, select: { media: refSelect } },
          _count: { select: { images: true } },
        },
      },
    },
  });
  return collections.map(collection => ({
    collection: {
      id: collection.id,
      slug: collection.slug,
      title: readText(collection.title, ru) || collection.slug,
      published: collection.published,
    },
    rows: collection.products.map(product => ({
      id: product.id,
      title: readText(product.title, ru) || product.slug,
      subtitle: `/${product.slug}`,
      thumb: toMediaRef(product.images[0]?.media),
      href: `/admin/products/${product.id}`,
      published: product.published,
      missingLocales: missingLocales(product.title),
      meta: [
        product.price === null ? t('priceOnRequest') : formatRubles(product.price),
        t('photos', { count: product._count.images }),
      ].join(' · '),
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
      images: { orderBy: { order: 'asc' }, select: { media: refSelect } },
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
    images: row.images.map(image => toMediaRef(image.media)),
    published: row.published,
  };
}

// ── reviews ───────────────────────────────────────────────────────────────────

/** Current star scale of review ratings (SiteSettings.reviewRatingMax; 5 before the first save). */
export async function getReviewRatingMax(): Promise<number> {
  await requireAdminPage();
  return loadReviewRatingMax();
}

async function loadReviewRatingMax(): Promise<number> {
  const row = await db.siteSettings.findUnique({ where: { id: 1 }, select: { reviewRatingMax: true } });
  return row?.reviewRatingMax ?? DEFAULT_REVIEW_RATING_MAX;
}

/**
 * Reviews in list order. `ratingAbove` keeps only reviews rated higher than that (the
 * settings page links here when the star scale cannot be lowered).
 */
export async function listReviewsAdmin(filter: { ratingAbove?: number } = {}): Promise<EntityRow[]> {
  await requireAdminPage();
  const [rows, ratingMax, t] = await Promise.all([
    db.review.findMany({
      where: filter.ratingAbove === undefined ? undefined : { rating: { gt: filter.ratingAbove } },
      orderBy: listOrder,
      select: { id: true, author: true, role: true, text: true, rating: true, published: true, avatar: refSelect },
    }),
    loadReviewRatingMax(),
    getAdminTranslations('admin.reviews'),
  ]);
  return rows.map(row => {
    const text = readText(row.text, ru);
    const rating =
      row.rating === null
        ? ''
        : row.rating > ratingMax
          ? t('aboveScale', { rating: row.rating, max: ratingMax })
          : formatStars(row.rating, ratingMax);
    return {
      id: row.id,
      title: row.author,
      subtitle: text.length > 120 ? `${text.slice(0, 120)}…` : text,
      thumb: toMediaRef(row.avatar),
      href: `/admin/reviews/${row.id}`,
      published: row.published,
      missingLocales: missingLocales(row.text),
      meta: [readText(row.role, ru), rating].filter(Boolean).join(' · ') || undefined,
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
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, slug: true, title: true, date: true, published: true, image: refSelect },
  });
  return rows.map(row => ({
    id: row.id,
    title: readText(row.title, ru) || row.slug,
    subtitle: `/${row.slug}`,
    thumb: toMediaRef(row.image),
    href: `/admin/news/${row.id}`,
    published: row.published,
    missingLocales: missingLocales(row.title),
    meta: toDateInputValue(row.date).split('-').reverse().join('.'),
  }));
}

export async function getNewsForm(id: string): Promise<NewsFormData | null> {
  await requireAdminPage();
  const row = await db.newsItem.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      body: true,
      date: true,
      published: true,
      image: refSelect,
    },
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
  const [rows, t] = await Promise.all([
    db.galleryItem.findMany({
      orderBy: listOrder,
      select: { id: true, caption: true, published: true, media: refSelect },
    }),
    getAdminTranslations('admin.gallery'),
  ]);
  return rows.map(row => ({
    id: row.id,
    title: readText(row.caption, ru) || t('noCaption'),
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
  return {
    id: row.id,
    media: toMediaRef(row.media),
    caption: parseLocalizedText(row.caption),
    published: row.published,
  };
}

// ── offers ────────────────────────────────────────────────────────────────────

export async function listOffersAdmin(): Promise<EntityRow[]> {
  await requireAdminPage();
  const [rows, t] = await Promise.all([
    db.offer.findMany({
      orderBy: listOrder,
      select: { id: true, title: true, badge: true, validUntil: true, published: true, image: refSelect },
    }),
    getAdminTranslations('admin.offers'),
  ]);
  const now = Date.now();
  return rows.map(row => {
    const until = row.validUntil;
    const expired = until !== null && until.getTime() < now;
    const untilText = until ? t('until', { date: toDateInputValue(until).split('-').reverse().join('.') }) : t('noEnd');
    return {
      id: row.id,
      title: readText(row.title, ru),
      subtitle: readText(row.badge, ru) || undefined,
      thumb: toMediaRef(row.image),
      href: `/admin/offers/${row.id}`,
      published: row.published,
      missingLocales: missingLocales(row.title),
      meta: expired ? t('expired', { until: untilText }) : untilText,
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
  return rows.map(row => ({
    id: row.id,
    title: row.name,
    subtitle: row.url ?? undefined,
    thumb: toMediaRef(row.logo),
    href: `/admin/partners/${row.id}`,
    published: row.published,
    missingLocales:
      Object.keys(parseLocalizedText(row.description)).length === 0 ? [] : missingLocales(row.description),
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
  const message = row.message.replace(/\s+/g, ' ').trim();
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
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: (page - 1) * LEADS_PAGE_SIZE,
    take: LEADS_PAGE_SIZE,
    select: leadListSelect,
  });
  return { items: rows.map(toLeadListItem), total, page, pageCount };
}

function flattenMeta(value: unknown): Array<{ key: string; value: string }> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return value === null || value === undefined ? [] : [{ key: 'meta', value: JSON.stringify(value) }];
  }
  return Object.entries(value)
    .slice(0, 50)
    .map(([key, item]) => ({
      key,
      value: typeof item === 'string' ? item : (JSON.stringify(item) ?? ''),
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

export async function getSettingsForm(): Promise<SettingsFormData> {
  await requireAdminPage();
  const row = await db.siteSettings.findUnique({
    where: { id: 1 },
    select: {
      phone: true,
      email: true,
      address: true,
      reviewRatingMax: true,
      seoTitle: true,
      seoDescription: true,
      ogImage: refSelect,
    },
  });
  return {
    phone: row?.phone ?? '',
    email: row?.email ?? '',
    address: parseLocalizedText(row?.address),
    reviewRatingMax: row?.reviewRatingMax ?? DEFAULT_REVIEW_RATING_MAX,
    seoTitle: parseLocalizedText(row?.seoTitle),
    seoDescription: parseLocalizedText(row?.seoDescription),
    ogImage: toMediaRef(row?.ogImage),
  };
}
