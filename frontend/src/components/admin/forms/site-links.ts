import { defaultLocale, locales } from '@/i18n/locales';
import { collectionPath, localizedPath } from '@/lib/seo/site-url';

import type { SiteLink } from './EntityFormShell';

/** «Посмотреть на сайте» links for every locale: "/#about", "/en#about" (ru has no prefix). */
export function siteLinksFor(anchor: string | null): SiteLink[] {
  return locales.map(locale => {
    const base = locale === defaultLocale ? '/' : `/${locale}`;
    return { locale, href: anchor ? `${base}#${anchor}` : base };
  });
}

/** «Посмотреть на сайте» for a collection page (optionally scrolled to a product card). */
export function collectionSiteLinks(collectionSlug: string, productSlug?: string): SiteLink[] {
  return locales.map(locale => {
    const path = localizedPath(locale, collectionPath(collectionSlug));
    return { locale, href: productSlug ? `${path}#product-${productSlug}` : path };
  });
}
