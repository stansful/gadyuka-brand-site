import 'server-only';
import { readAdminData, readAdminRow } from '@/lib/api/admin-read';
import { LEAD_FORM_ANCHOR, SECTION_ANCHORS } from '@/lib/content/anchors';
import { isSectionId } from '@/lib/content/registry';
import { missingLocales, readText, type LocalizedText } from '@/lib/localized-text';
import type {
  AdminGalleryItemDetails,
  AdminGalleryListResponse,
  AdminMenuItemDetails,
  AdminMenuItemListResponse,
  AdminMenuLinkTargetsResponse,
  AdminNewsDetails,
  AdminNewsListResponse,
  AdminOfferDetails,
  AdminOfferListResponse,
  AdminPartnerDetails,
  AdminPartnerListResponse,
  AdminSocialDefaultLabelsResponse,
  AdminSocialLinkDetails,
  AdminSocialLinkListResponse,
  SocialType,
} from '@shared/contracts/content-entities';

import type { EntityRow } from '../types';

import { requireAdminPage } from '../auth';
import { formatCalendarDay, type MenuHrefOption } from '../content-entities';
import { getAdminTranslations } from '../i18n-server';

/**
 * Content entities: menu items, social links, news, gallery, offers, partners.
 *
 * Admin page data from the backend (/api/v1/admin/…, shared/contracts/content-entities.ts) turned
 * into the view models of the admin lists and forms. EVERY exported function authorizes first
 * (requireAdminPage → redirect to /admin/login); the backend checks the session and the role again.
 * A form of a row that does not exist answers null (the page shows «not found»); a backend failure
 * throws (the admin's error page).
 */

const ru = 'ru' as const;

const PATHS = {
  menuItems: '/api/v1/admin/menu-items',
  menuLinkTargets: '/api/v1/admin/menu-items/link-targets',
  socialLinks: '/api/v1/admin/social-links',
  socialDefaultLabels: '/api/v1/admin/social-links/default-labels',
  news: '/api/v1/admin/news',
  gallery: '/api/v1/admin/gallery',
  offers: '/api/v1/admin/offers',
  partners: '/api/v1/admin/partners',
} as const;

// ── menu ──────────────────────────────────────────────────────────────────────

export async function listMenuItemsAdmin(): Promise<EntityRow[]> {
  await requireAdminPage();
  const [{ items }, t] = await Promise.all([
    readAdminData<AdminMenuItemListResponse>(PATHS.menuItems),
    getAdminTranslations('admin.menu.placement'),
  ]);
  /** «в шапке · в подвале» */
  const menuPlacement = (row: { showInHeader: boolean; showInFooter: boolean }): string => {
    const places = [row.showInHeader ? t('header') : '', row.showInFooter ? t('footer') : ''].filter(Boolean);
    return places.length > 0 ? places.join(' · ') : t('none');
  };
  return items.map(row => ({
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

export async function getMenuItemForm(id: string): Promise<AdminMenuItemDetails | null> {
  await requireAdminPage();
  return readAdminRow<AdminMenuItemDetails>(`${PATHS.menuItems}/${encodeURIComponent(id)}`);
}

/**
 * Link suggestions of the menu form: every landing anchor (named like its «Тексты сайта»
 * section), the lead form, then every collection page.
 */
export async function getMenuHrefOptions(): Promise<MenuHrefOption[]> {
  await requireAdminPage();
  const [{ collections }, sections, t] = await Promise.all([
    readAdminData<AdminMenuLinkTargetsResponse>(PATHS.menuLinkTargets),
    getAdminTranslations('admin.siteTexts'),
    getAdminTranslations('admin.menu.hrefOptions'),
  ]);
  const anchors = Object.entries(SECTION_ANCHORS).flatMap(([section, anchor]): MenuHrefOption[] =>
    anchor ? [{ href: `#${anchor}`, label: isSectionId(section) ? sections(`sections.${section}`) : section }] : [],
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

// ── social links ──────────────────────────────────────────────────────────────

export async function listSocialLinksAdmin(): Promise<EntityRow[]> {
  await requireAdminPage();
  const [{ items }, t] = await Promise.all([
    readAdminData<AdminSocialLinkListResponse>(PATHS.socialLinks),
    getAdminTranslations('admin.socials'),
  ]);
  return items.map(row => {
    const hasOwnLabel = Object.keys(row.label).length > 0;
    const typeLabel = t(`types.${row.type}`);
    return {
      id: row.id,
      title: readText(row.label, ru) || typeLabel,
      subtitle: row.url,
      thumb: null,
      href: `/admin/socials/${row.id}`,
      published: row.published,
      missingLocales: hasOwnLabel ? missingLocales(row.label) : [],
      meta: [hasOwnLabel ? typeLabel : t('defaultLabel'), row.bareUrl ? t('bareUrl') : ''].filter(Boolean).join(' · '),
    };
  });
}

/**
 * The site's own label of each social type — the «Тексты сайта» value of `social.<TYPE>`
 * (admin edit, else the default), shown when a link has no label of its own.
 */
export async function getSocialDefaultLabels(): Promise<Record<SocialType, LocalizedText>> {
  await requireAdminPage();
  const { labels } = await readAdminData<AdminSocialDefaultLabelsResponse>(PATHS.socialDefaultLabels);
  return labels;
}

export async function getSocialLinkForm(id: string): Promise<AdminSocialLinkDetails | null> {
  await requireAdminPage();
  return readAdminRow<AdminSocialLinkDetails>(`${PATHS.socialLinks}/${encodeURIComponent(id)}`);
}

// ── news ──────────────────────────────────────────────────────────────────────

export async function listNewsAdmin(): Promise<EntityRow[]> {
  await requireAdminPage();
  const { items } = await readAdminData<AdminNewsListResponse>(PATHS.news);
  return items.map(row => ({
    id: row.id,
    title: readText(row.title, ru) || row.slug,
    subtitle: `/${row.slug}`,
    thumb: row.image,
    href: `/admin/news/${row.id}`,
    published: row.published,
    missingLocales: missingLocales(row.title),
    meta: formatCalendarDay(row.date),
  }));
}

export async function getNewsForm(id: string): Promise<AdminNewsDetails | null> {
  await requireAdminPage();
  return readAdminRow<AdminNewsDetails>(`${PATHS.news}/${encodeURIComponent(id)}`);
}

// ── gallery ───────────────────────────────────────────────────────────────────

export async function listGalleryAdmin(): Promise<EntityRow[]> {
  await requireAdminPage();
  const [{ items }, t] = await Promise.all([
    readAdminData<AdminGalleryListResponse>(PATHS.gallery),
    getAdminTranslations('admin.gallery'),
  ]);
  return items.map(row => ({
    id: row.id,
    title: readText(row.caption, ru) || t('noCaption'),
    thumb: row.media,
    href: `/admin/gallery/${row.id}`,
    published: row.published,
    missingLocales: Object.keys(row.caption).length === 0 ? [] : missingLocales(row.caption),
  }));
}

export async function getGalleryForm(id: string): Promise<AdminGalleryItemDetails | null> {
  await requireAdminPage();
  return readAdminRow<AdminGalleryItemDetails>(`${PATHS.gallery}/${encodeURIComponent(id)}`);
}

// ── offers ────────────────────────────────────────────────────────────────────

export async function listOffersAdmin(): Promise<EntityRow[]> {
  await requireAdminPage();
  const [{ items }, t] = await Promise.all([
    readAdminData<AdminOfferListResponse>(PATHS.offers),
    getAdminTranslations('admin.offers'),
  ]);
  return items.map(row => {
    const untilText = row.validUntil ? t('until', { date: formatCalendarDay(row.validUntil) }) : t('noEnd');
    return {
      id: row.id,
      title: readText(row.title, ru),
      subtitle: readText(row.badge, ru) || undefined,
      thumb: row.image,
      href: `/admin/offers/${row.id}`,
      published: row.published,
      missingLocales: missingLocales(row.title),
      meta: row.expired ? t('expired', { until: untilText }) : untilText,
    };
  });
}

export async function getOfferForm(id: string): Promise<AdminOfferDetails | null> {
  await requireAdminPage();
  return readAdminRow<AdminOfferDetails>(`${PATHS.offers}/${encodeURIComponent(id)}`);
}

// ── partners ──────────────────────────────────────────────────────────────────

export async function listPartnersAdmin(): Promise<EntityRow[]> {
  await requireAdminPage();
  const { items } = await readAdminData<AdminPartnerListResponse>(PATHS.partners);
  return items.map(row => ({
    id: row.id,
    title: row.name,
    subtitle: row.url ?? undefined,
    thumb: row.logo,
    href: `/admin/partners/${row.id}`,
    published: row.published,
    missingLocales: Object.keys(row.description).length === 0 ? [] : missingLocales(row.description),
  }));
}

export async function getPartnerForm(id: string): Promise<AdminPartnerDetails | null> {
  await requireAdminPage();
  return readAdminRow<AdminPartnerDetails>(`${PATHS.partners}/${encodeURIComponent(id)}`);
}
