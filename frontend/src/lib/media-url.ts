/**
 * Public asset URL conventions (isomorphic — safe in client components).
 *
 * - Media (uploads + seed images) live in S3 / MinIO; their public link is stored in Media.url
 *   ("/media/<admin|user>/<ownerId>/<uuid>/image.webp", built by the backend, served by
 *   src/app/media/[...key]/route.ts) — the site and the admin use it as is.
 * - Static brand assets (SVG logo, wordmark, art) live in public/brand → "/brand/...",
 *   with the file's content hash as `?v=…` (taken at build time, next.config.ts) — such URLs are
 *   cached for good. Not for next/image (its localPatterns allow /brand without a query).
 */
export const BRAND_URL_PREFIX = '/brand';

/** File name → content hash of public/brand/*.svg (next.config.ts inlines it at build). */
export type BrandAssetVersions = Readonly<Record<string, string>>;

function parseBrandAssetVersions(json: string | undefined): BrandAssetVersions {
  if (!json) return {};
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );
  } catch {
    return {};
  }
}

const BRAND_ASSET_VERSIONS = parseBrandAssetVersions(process.env.BRAND_ASSET_VERSIONS);

/** "wordmark-ink.svg" → "/brand/wordmark-ink.svg?v=<content hash>" (no `?v` for a file without one) */
export function brandAssetUrl(fileName: string, versions: BrandAssetVersions = BRAND_ASSET_VERSIONS): string {
  const name = fileName.replace(/^\/+/, '');
  const version = versions[name];
  return `${BRAND_URL_PREFIX}/${name}${version ? `?v=${encodeURIComponent(version)}` : ''}`;
}
