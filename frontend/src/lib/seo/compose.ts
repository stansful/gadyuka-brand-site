import { locales, type Locale } from '@/i18n/locales';
import type { ImageRef, SettingsView } from '@/lib/content/types';

import type { Metadata } from 'next';

import { type BrandCopy, DEFAULT_OG_IMAGE, pageTitle } from './brand';
import { absoluteUrl, getSiteUrl, isLocalSiteUrl, languageAlternates, localizedUrl, openGraphLocale } from './site-url';

/**
 * Pure metadata composition (no DB access) — see metadata.ts for the async wrappers
 * that load SiteSettings and the brand messages. Kept separate so it can be unit-tested.
 */

export type SeoSettings = Pick<SettingsView, 'seoTitle' | 'seoDescription' | 'ogImage'>;

/** The brand messages metadata needs: its name in the page's language and the title template. */
export type SeoBrand = Pick<BrandCopy, 'name' | 'titleTemplate'>;

export type BuildMetadataOptions = {
  /**
   * Locale-independent page path ("/", "/catalog/<slug>"). Sets canonical + hreflang
   * (ru, en, x-default) and og:url. Omit for layouts / pages without a canonical URL.
   */
  path?: string;
  /**
   * Page title; rendered in the brand's title template (brand.pageTitle: "<title> — ГАДЮКА",
   * "— GADYUKA" on the English site). Default: SiteSettings.seoTitle.
   */
  title?: string;
  /** Default: SiteSettings.seoDescription. */
  description?: string;
  /** Share image; default: SiteSettings.ogImage, then the generated /opengraph-image.png. */
  image?: ImageRef | null;
  /** Exclude the page from search engines. */
  noIndex?: boolean;
  /** Open Graph type (default "website"). */
  type?: 'website' | 'article';
};

type OgImage = { url: string; width: number; height: number; alt: string; type?: string };

const DESCRIPTION_MAX = 300;

function clip(text: string, max: number): string {
  const value = text.replace(/\s+/g, ' ').trim();
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

export function shareImage(image: ImageRef | null | undefined, fallbackAlt: string, siteUrl: string): OgImage {
  if (image) {
    return {
      url: absoluteUrl(image.src, siteUrl),
      width: image.width,
      height: image.height,
      alt: image.alt || fallbackAlt || image.altDefault,
      type: image.mime,
    };
  }
  return {
    url: absoluteUrl(DEFAULT_OG_IMAGE.path, siteUrl),
    width: DEFAULT_OG_IMAGE.width,
    height: DEFAULT_OG_IMAGE.height,
    alt: fallbackAlt,
    type: DEFAULT_OG_IMAGE.type,
  };
}

function siteVerification(): Metadata['verification'] | undefined {
  const google = process.env.GOOGLE_SITE_VERIFICATION?.trim();
  const yandex = process.env.YANDEX_VERIFICATION?.trim();
  if (!google && !yandex) return undefined;
  return { ...(google ? { google } : {}), ...(yandex ? { yandex } : {}) };
}

/** Defaults for the whole public site (used by src/app/[locale]/layout.tsx). No canonical here. */
export function composeRootMetadata(
  locale: Locale,
  settings: SeoSettings,
  seoBrand: SeoBrand,
  siteUrl: string = getSiteUrl(),
): Metadata {
  const brand = seoBrand.name;
  const siteTitle = settings.seoTitle || brand;
  const description = settings.seoDescription ? clip(settings.seoDescription, DESCRIPTION_MAX) : undefined;
  const image = shareImage(settings.ogImage, siteTitle, siteUrl);
  const local = isLocalSiteUrl(siteUrl);
  return {
    metadataBase: new URL(siteUrl),
    applicationName: brand,
    title: { default: siteTitle, template: seoBrand.titleTemplate },
    description,
    openGraph: {
      type: 'website',
      siteName: brand,
      locale: openGraphLocale(locale),
      title: siteTitle,
      description,
      images: [image],
    },
    twitter: { card: 'summary_large_image', title: siteTitle, description, images: [image.url] },
    robots: local ? { index: false, follow: false } : { index: true, follow: true },
    verification: siteVerification(),
    formatDetection: { telephone: false },
  };
}

/** Full metadata for one public page: title, description, canonical, hreflang, OG, Twitter. */
export function composeMetadata(
  locale: Locale,
  settings: SeoSettings,
  seoBrand: SeoBrand,
  options: BuildMetadataOptions = {},
  siteUrl: string = getSiteUrl(),
): Metadata {
  const brand = seoBrand.name;
  const siteTitle = settings.seoTitle || brand;
  const title = options.title ? pageTitle(seoBrand, options.title) : siteTitle;
  const rawDescription = options.description || settings.seoDescription;
  const description = rawDescription ? clip(rawDescription, DESCRIPTION_MAX) : undefined;
  const image = shareImage(options.image === undefined ? settings.ogImage : options.image, title, siteUrl);
  const canonical = options.path !== undefined ? localizedUrl(locale, options.path, siteUrl) : undefined;
  const noIndex = options.noIndex === true || isLocalSiteUrl(siteUrl);

  return {
    title: { absolute: title },
    description,
    alternates:
      options.path !== undefined ? { canonical, languages: languageAlternates(options.path, siteUrl) } : undefined,
    openGraph: {
      type: options.type ?? 'website',
      siteName: brand,
      url: canonical,
      title,
      description,
      locale: openGraphLocale(locale),
      alternateLocale: locales.filter(other => other !== locale).map(openGraphLocale),
      images: [image],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
    robots: noIndex ? { index: false, follow: false } : { index: true, follow: true },
  };
}
