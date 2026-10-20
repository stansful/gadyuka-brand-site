import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import createNextIntlPlugin from 'next-intl/plugin';

import type { NextConfig } from 'next';

import { LOCALE_FALLBACK_REWRITE } from './src/i18n/locale-fallback';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * Baseline security headers for every page, the admin and the API — mirrored in the
 * Caddyfile (Caddy overwrites them with identical values in production). Keeping them here
 * too means `next start` without Caddy is not left without any protection.
 *
 * CSP baseline (no script-src yet — tighten with nonces later, starting with /admin):
 * no <base> hijacking, no plugins, no framing by other sites, forms post only to us.
 * /media/* is excluded: those responses carry their own, stricter sandbox CSP
 * (src/app/media/[...key]/route.ts).
 */
const BASELINE_CSP = "base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'";

const securityHeaders = [
  { key: 'Content-Security-Policy', value: BASELINE_CSP },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // Ignored by browsers over plain HTTP (local dev); includeSubDomains — see DEPLOY.md.
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

const nextConfig: NextConfig = {
  output: 'standalone',
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
  poweredByHeader: false,
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
    //  /media/**  — admin uploads + seed media (Media.url: S3 / MinIO, streamed by the
    //               src/app/media/[...key] route handler — same origin, so no remotePatterns
    //               and no dangerouslyAllowLocalIP for the private MinIO host)
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
