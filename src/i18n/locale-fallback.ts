import { defaultLocale, locales } from './locales';

/**
 * Stray paths → the localized 404 (an `afterFiles` rewrite of next.config.ts).
 *
 * The proxy (src/proxy.ts) skips every path with a dot and the api / brand / _vercel prefixes,
 * so next-intl never puts those under a locale. Their first segment would then become the
 * [locale] param ("/index.html" → locale "index.html"): the root layout calls notFound() above
 * every not-found.tsx, and the visitor gets Next's built-in English 404. This rewrite moves such
 * a path under the default locale instead ("/index.html" → "/ru/index.html"), where
 * [locale]/[...rest] answers with the localized 404 page (messages notFound.*).
 *
 * `afterFiles` runs after the filesystem check — public files and static routes (/favicon.ico,
 * /robots.txt, /sitemap.xml, /api/leads …) are served first — and before the dynamic routes, so
 * it decides before [locale] does. Left alone: paths that already start with a locale (the proxy
 * rewrote them or they came prefixed) and the prefixes with dynamic routes or internals of their
 * own: /admin/** (the admin's own 404), /media/** (the media route handler), /_next/**.
 * A new top-level folder of src/app with a dynamic segment belongs in KEPT_FIRST_SEGMENTS too
 * (./locale-fallback.test.ts checks it).
 */

/** First segments that must never get the default-locale prefix. */
const KEPT_FIRST_SEGMENTS: readonly string[] = [...locales, 'admin', 'media', '_next'];

export const LOCALE_FALLBACK_REWRITE = {
  // `(?:/|$)`: only the whole segment counts ("/en.json" and "/admin.php" are stray, "/en/x" is not).
  source: `/:first((?!(?:${KEPT_FIRST_SEGMENTS.join('|')})(?:/|$))[^/]+)/:rest*`,
  destination: `/${defaultLocale}/:first/:rest*`,
} as const;
