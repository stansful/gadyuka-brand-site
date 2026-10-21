import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import createNextIntlPlugin from 'next-intl/plugin';

import type { NextConfig } from 'next';

import { LOCALE_FALLBACK_REWRITE } from './src/i18n/locale-fallback';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * Baseline security headers for every page, the admin and the API — mirrored by the reverse
 * proxy (it overwrites them with identical values in production, docs/COMPRESSION.md). Keeping them
 * here too means `next start` without the proxy is not left without any protection.
 *
 * CSP baseline (no script-src yet — tighten with nonces later, starting with /admin):
 * no <base> hijacking, no plugins, no framing by other sites, forms post only to us.
 * /media/* is excluded: those responses carry their own, stricter sandbox CSP (set by the backend,
 * passed through by src/app/media/[...key]/route.ts).
 */
const BASELINE_CSP = "base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'";

const securityHeaders = [
  { key: 'Content-Security-Policy', value: BASELINE_CSP },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // Ignored by browsers over plain HTTP (local dev); add includeSubDomains only once every subdomain is HTTPS.
  ...(process.env.NODE_ENV === 'production' ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }] : []),
];

/**
 * Content hash of every public/brand/*.svg, taken at build time and inlined as
 * process.env.BRAND_ASSET_VERSIONS (JSON, file name → hash): brandAssetUrl (src/lib/media-url.ts)
 * adds it as `?v=…`, so an edited file gets a new URL with the next build and the old one can be
 * cached for good (headers() below).
 */
function brandAssetVersions(): string {
  const dir = path.join(process.cwd(), 'public', 'brand');
  const versions: Record<string, string> = {};
  try {
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.svg')) continue;
      versions[name] = createHash('sha256')
        .update(readFileSync(path.join(dir, name)))
        .digest('base64url')
        .slice(0, 8);
    }
  } catch (error: unknown) {
    // No public/brand (a stripped runtime image re-reading the config): unversioned URLs.
    console.warn('brand asset versions unavailable:', error instanceof Error ? error.message : error);
  }
  return JSON.stringify(versions);
}

/** public/brand/* under a content-hashed URL (?v=…, brandAssetUrl) — see headers(). */
const BRAND_CACHE_VERSIONED = 'public, max-age=31536000, immutable';
/** public/brand/* without a version (the admin's wordmark, an outdated page): revalidated on every use. */
const BRAND_CACHE_UNVERSIONED = 'public, max-age=0, must-revalidate';

/**
 * The repository root: the app imports ../shared (messages, API contracts — tsconfig paths
 * "@shared/*"), and Turbopack resolves nothing outside its root. Output file tracing uses the same
 * root, so the standalone output mirrors the repository layout: the server is
 * .next/standalone/frontend/server.js with its traced dependencies in .next/standalone/frontend/node_modules
 * (its static files go to .next/standalone/frontend/.next/static and .next/standalone/frontend/public).
 */
const REPOSITORY_ROOT = path.join(__dirname, '..');

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: { root: REPOSITORY_ROOT },
  outputFileTracingRoot: REPOSITORY_ROOT,
  // Cache Components model: data is cached with "use cache" + cacheTag/cacheLife
  // (see src/lib/content/cache.ts), invalidated with updateTag/revalidateTag.
  cacheComponents: true,
  // Kept OFF on purpose (explicit false: unset logs a warning). In Next 16.4.2 (still in
  // 16.5.0-canary.20) a failing "use cache" read that is repeated within one request is never
  // marked settled (createTrackedReadableStream only settles on completion), and with Partial
  // Prefetching every dynamic render waits for all cache reads — so during a DB outage ~50% of
  // uncached catalog pages hung forever. Off: 0/24 hung, real 404/500 statuses, dynamic responses
  // halved. The public site uses plain <a> links, so visitors gained nothing from it.
  // Re-check before the next major (the feature becomes the default there).
  partialPrefetching: false,
  // Blocking metadata for every visitor, not only Next's list of HTML-limited bots. The public
  // pages render at request time (backend data), and with streamed metadata the first bytes go out
  // before a page can call notFound(): an unknown path or collection then answered 200 + noindex
  // instead of 404 (browsers, Googlebot, link checkers). Blocking, the status is known before the
  // body starts, as it was with the prerendered pages. Cost measured (/, /en, catalog; warm cache,
  // local, also with 60 ms RTT): TTFB +11–17 ms, FCP / LCP / DCL / load unchanged within ±8 ms —
  // the documents block on the same cached reads anyway.
  htmlLimitedBots: /.*/,
  poweredByHeader: false,
  // Next's own on-the-fly gzip stays ON — it is the fallback for anything that reaches the app
  // directly: `next start` / the standalone server without a proxy (local runs, a health check, a
  // misconfigured proxy). Gzip is all it has (no brotli / zstd), and with a page's HTML carrying
  // its RSC payload twice brotli/zstd pay off most there (landing: gzip 47 KB vs brotli ~28 KB).
  // In production the reverse proxy owns compression (docs/COMPRESSION.md): it serves
  // /_next/static and public/ precompressed from disk (.br / .zst / .gz written by
  // scripts/precompress.mjs after `next build`) and compresses the dynamic HTML / RSC itself, and
  // it forwards requests WITHOUT Accept-Encoding — Next then sends identity (verified: no
  // Accept-Encoding → no Content-Encoding) and never spends event-loop time gzipping behind it.
  compress: true,
  env: {
    BRAND_ASSET_VERSIONS: brandAssetVersions(),
  },
  experimental: {
    // Kept OFF on purpose. Inlining ships the ~73 KB stylesheet twice (in <style> and again in the
    // RSC payload), doubling the landing HTML (gzip 41 → 76 KB) and making the CSS uncacheable.
    // Measured (Lighthouse 13.5 mobile, median of 3): with a cacheable <link> the landing is
    // FCP 0.90 s / LCP 3.45 s / perf 91 vs 1.15 s / 3.67 s / 90 inlined; /en and the catalog page
    // are equal or better too.
    inlineCss: false,
  },
  images: {
    // Only first-party files may go through the optimizer:
    //  /media/**  — admin uploads + seed media (Media.url: the backend's bucket, streamed by the
    //               src/app/media/[...key] route handler from ${BACKEND_URL}/media/** — same origin,
    //               so no remotePatterns and no dangerouslyAllowLocalIP for the private backend)
    //  /brand/**  — static brand assets in public/brand
    localPatterns: [
      { pathname: '/media/**', search: '' },
      { pathname: '/brand/**', search: '' },
    ],
    formats: ['image/avif', 'image/webp'],
    qualities: [75, 90],
  },
  async rewrites() {
    // Paths the proxy skips (a dot, /brand…) → the localized 404 instead of Next's built-in one
    // (src/i18n/locale-fallback.ts). After the filesystem: real files are served first.
    return { beforeFiles: [], afterFiles: [LOCALE_FALLBACK_REWRITE], fallback: [] };
  },
  async headers() {
    return [
      { source: '/((?!media/).*)', headers: securityHeaders },
      // Brand vectors (public/brand) are requested by several consumers of one page — the
      // header mark (CSS mask), the hero snake (SVG <use>), the mobile menu — and on every
      // page view. The public pages ask for them by content-hashed URL (?v=…): cached for good,
      // one download serves them all without a 304 round trip each; an edited file gets a new
      // URL with the next build. Anything else asking without a version revalidates.
      {
        source: '/brand/:path*',
        has: [{ type: 'query', key: 'v' }],
        headers: [{ key: 'Cache-Control', value: BRAND_CACHE_VERSIONED }],
      },
      {
        source: '/brand/:path*',
        missing: [{ type: 'query', key: 'v' }],
        headers: [{ key: 'Cache-Control', value: BRAND_CACHE_UNVERSIONED }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
