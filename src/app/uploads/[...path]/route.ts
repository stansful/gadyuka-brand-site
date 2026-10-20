import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { getUploadDir, resolveUploadPath } from "@/lib/uploads";

/**
 * Fallback file server for UPLOAD_DIR (dev, or prod without Caddy):
 *   GET /uploads/2026/10/<random>.webp → <UPLOAD_DIR>/2026/10/<random>.webp
 *
 * Safety:
 *  - resolveUploadPath() rejects "..", absolute paths, hidden files and odd characters;
 *  - the real path (symlinks resolved) must still be inside the real UPLOAD_DIR;
 *  - only raster image types are served (no SVG / HTML — nothing executable), with nosniff.
 * Stored names are random and never overwritten, so responses are cached immutably.
 */

const SERVED_CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
};

const notFound = (): Response =>
  new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

function isMissingFileError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR" || error.code === "EACCES" || error.code === "ELOOP")
  );
}

export async function GET(request: Request, { params }: RouteContext<"/uploads/[...path]">): Promise<Response> {
  const segments = (await params).path;
  if (segments.length === 0) return notFound();

  const filePath = resolveUploadPath(segments.join("/"));
  if (!filePath) return notFound();
  const contentType = SERVED_CONTENT_TYPES[path.extname(filePath).toLowerCase()];
  if (!contentType) return notFound();

  try {
    const [realRoot, realFile] = await Promise.all([realpath(getUploadDir()), realpath(filePath)]);
    if (!realFile.startsWith(realRoot + path.sep)) return notFound();

    const info = await stat(realFile);
    if (!info.isFile()) return notFound();

    const etag = `"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
    const headers = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: etag,
      "Last-Modified": info.mtime.toUTCString(),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    };
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers });
    }

    const body = await readFile(realFile);
    return new Response(new Uint8Array(body), {
      headers: { ...headers, "Content-Length": String(body.byteLength) },
    });
  } catch (error: unknown) {
    if (isMissingFileError(error)) return notFound();
    throw error;
  }
}
