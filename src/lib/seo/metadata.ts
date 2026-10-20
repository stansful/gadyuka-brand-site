import 'server-only';
import { getTranslations } from 'next-intl/server';

import type { Locale } from '@/i18n/locales';
import { getSiteSettings } from '@/lib/content';

import type { Metadata } from 'next';

import { pageTitle } from './brand';
import { getBrandCopy } from './brand-copy';
import { type BuildMetadataOptions, composeMetadata, composeRootMetadata } from './compose';

/**
 * Next.js metadata for public pages, driven by SiteSettings SEO fields and the brand messages
 * (brand.name, brand.pageTitle) — both cached ("use cache" + cacheTag("content")).
 *
 *   // page.tsx
 *   export async function generateMetadata({ params }: PageProps<"/[locale]">) {
 *     return buildMetadata(toLocale((await params).locale), { path: "/" });
 *   }
 *   // catalog/[slug]/page.tsx
 *   buildMetadata(locale, { path: collectionPath(slug), title: collection.title,
 *                           description: collection.description, image: collection.cover })
 */
export async function buildMetadata(locale: Locale, options: BuildMetadataOptions = {}): Promise<Metadata> {
  const [settings, brand] = await Promise.all([getSiteSettings(locale), getBrandCopy(locale)]);
  return composeMetadata(locale, settings, brand, options);
}

/** Site-wide defaults for src/app/[locale]/layout.tsx (metadataBase, title template, OG/Twitter). */
export async function buildRootMetadata(locale: Locale): Promise<Metadata> {
  const [settings, brand] = await Promise.all([getSiteSettings(locale), getBrandCopy(locale)]);
  return composeRootMetadata(locale, settings, brand);
}

/** 404 pages: «Страница не найдена — ГАДЮКА», never indexed (no canonical / hreflang). */
export async function notFoundMetadata(locale: Locale): Promise<Metadata> {
  const [t, brand] = await Promise.all([getTranslations({ locale, namespace: 'notFound' }), getBrandCopy(locale)]);
  return { title: { absolute: pageTitle(brand, t('title')) }, robots: { index: false, follow: false } };
}

export type { BuildMetadataOptions } from './compose';
