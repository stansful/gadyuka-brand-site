import { defaultLocale, locales, localeTags, type Locale } from "@/i18n/locales";

/**
 * Public URLs for SEO (canonical, hreflang, sitemap, Open Graph, JSON-LD). Isomorphic.
 *
 * Routing (src/i18n/routing.ts, localePrefix "as-needed"): ru has no prefix ("/"),
 * other locales are prefixed ("/en"). Paths passed here are locale-independent
 * ("/", "/catalog/<slug>").
 */

const DEV_SITE_URL = "http://localhost:3000";

/** Origin of the public site from SITE_URL (no trailing slash), e.g. "https://gadyuka.ru". */
export function getSiteUrl(): string {
  return normalizeSiteUrl(process.env.SITE_URL);
}

export function normalizeSiteUrl(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) return DEV_SITE_URL;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return DEV_SITE_URL;
    return url.origin;
  } catch {
    return DEV_SITE_URL;
  }
}

/** True for local / dev origins (pages are marked noindex there). */
export function isLocalSiteUrl(siteUrl: string): boolean {
  try {
    const host = new URL(siteUrl).hostname;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "[::1]" ||
      host.endsWith(".localhost") ||
      host.endsWith(".test")
    );
  } catch {
    return true;
  }
}

function cleanPath(path: string): string {
  if (!path || path === "/") return "/";
  const withSlash = path.startsWith("/") ? path : `/${path}`;
  return withSlash.replace(/\/+$/, "");
}

/** "/" + ru → "/"; "/" + en → "/en"; "/catalog/x" + en → "/en/catalog/x". */
export function localizedPath(locale: Locale, path = "/"): string {
  const clean = cleanPath(path);
  if (locale === defaultLocale) return clean;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}

/** Absolute URL for a site path ("/x" → "https://site/x"); absolute http(s) URLs are returned as is. */
export function absoluteUrl(path: string, siteUrl: string = getSiteUrl()): string {
  if (/^https?:\/\//i.test(path)) return path;
  const clean = cleanPath(path);
  return clean === "/" ? siteUrl : `${siteUrl}${clean}`;
}

export function localizedUrl(locale: Locale, path = "/", siteUrl: string = getSiteUrl()): string {
  return absoluteUrl(localizedPath(locale, path), siteUrl);
}

/** hreflang map for a path: { ru, en, "x-default" } (x-default = the default locale). */
export function languageAlternates(path = "/", siteUrl: string = getSiteUrl()): Record<string, string> {
  const out: Record<string, string> = {};
  for (const locale of locales) out[locale] = localizedUrl(locale, path, siteUrl);
  out["x-default"] = localizedUrl(defaultLocale, path, siteUrl);
  return out;
}

/** Open Graph locale: "ru_RU", "en_US". */
export function openGraphLocale(locale: Locale): string {
  return localeTags[locale].replace("-", "_");
}

/** Locale-independent path of a collection page (src/app/[locale]/catalog/[slug]/page.tsx). */
export function collectionPath(slug: string): string {
  return `/catalog/${encodeURIComponent(slug)}`;
}
