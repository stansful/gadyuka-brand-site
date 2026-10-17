/**
 * Media URL conventions (isomorphic — safe in client components).
 *
 * - Files live in UPLOAD_DIR (env, default "./uploads", relative to the app cwd).
 * - Media.path in the DB is RELATIVE to UPLOAD_DIR, uses forward slashes and has no
 *   leading slash, e.g. "seed/hoodie-white-logo.webp" or "2026/10/<id>.webp".
 * - Public URL = UPLOAD_URL_PREFIX + "/" + path, e.g. "/uploads/seed/hoodie-white-logo.webp".
 *   In production Caddy serves /uploads/* straight from the volume; in dev the
 *   fallback route handler src/app/uploads/[...path]/route.ts does it.
 * - Static brand assets (SVG logo, wordmark, cutouts) live in public/brand → "/brand/...",
 *   with the file's content hash as `?v=…` (taken at build time, next.config.ts) — such URLs are
 *   cached for good. Not for next/image (its localPatterns allow /brand without a query).
 */
export const UPLOAD_URL_PREFIX = "/uploads";
export const BRAND_URL_PREFIX = "/brand";

/** "seed/a.webp" → "/uploads/seed/a.webp" (each segment URI-encoded). */
export function mediaPublicUrl(relativePath: string): string {
  const clean = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const encoded = clean
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${UPLOAD_URL_PREFIX}/${encoded}`;
}

/** File name → content hash of public/brand/*.svg (next.config.ts inlines it at build). */
export type BrandAssetVersions = Readonly<Record<string, string>>;

function parseBrandAssetVersions(json: string | undefined): BrandAssetVersions {
  if (!json) return {};
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  } catch {
    return {};
  }
}

const BRAND_ASSET_VERSIONS = parseBrandAssetVersions(process.env.BRAND_ASSET_VERSIONS);

/** "logo-black-ink.svg" → "/brand/logo-black-ink.svg?v=<content hash>" (no `?v` for a file without one) */
export function brandAssetUrl(fileName: string, versions: BrandAssetVersions = BRAND_ASSET_VERSIONS): string {
  const name = fileName.replace(/^\/+/, "");
  const version = versions[name];
  return `${BRAND_URL_PREFIX}/${name}${version ? `?v=${encodeURIComponent(version)}` : ""}`;
}
