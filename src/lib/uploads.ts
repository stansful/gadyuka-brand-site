import "server-only";
import path from "node:path";

/**
 * Server-side upload directory helpers. See src/lib/media-url.ts for the URL conventions.
 */

/** Absolute path of UPLOAD_DIR (env, default "./uploads", resolved against process.cwd()). */
export function getUploadDir(): string {
  // turbopackIgnore: UPLOAD_DIR is a runtime volume, not part of the build output.
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.UPLOAD_DIR ?? "./uploads");
}

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

/**
 * Resolve a Media.path (relative, "/"-separated) to an absolute file path inside
 * UPLOAD_DIR. Returns null for anything that could escape the directory
 * (.., absolute paths, odd characters, hidden files).
 */
export function resolveUploadPath(relativePath: string): string | null {
  const segments = relativePath.split("/");
  if (segments.length === 0 || segments.length > 8) return null;
  for (const segment of segments) {
    if (!SAFE_SEGMENT.test(segment) || segment.startsWith(".")) return null;
  }
  const root = getUploadDir();
  const absolute = path.resolve(/*turbopackIgnore: true*/ root, ...segments);
  if (absolute !== root && !absolute.startsWith(root + path.sep)) return null;
  return absolute;
}

/** Content types the /uploads fallback route is allowed to serve. */
export const UPLOAD_CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};
