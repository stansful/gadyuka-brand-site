import { requireAdminRoute } from '@/lib/admin/auth';
import { mediaJson, mediaReadFailure, mediaUploadFailure } from '@/lib/admin/media-responses';
import { translateAdminMessage } from '@/lib/api/admin-messages';
import { listMediaPage, MAX_UPLOAD_BODY_BYTES, UPLOAD_TOO_LARGE, uploadMediaStream } from '@/lib/api/media';

/**
 * Admin media API (Route Handler: uploads exceed the 1 MB Server Action body limit). The backend
 * does the work (/api/v1/admin/media); this checks the session and keeps the answers the media
 * dialogs read (src/components/admin/media/media-api.ts):
 *
 *   GET  /admin/api/media?cursor=<id>&q=<text>  → { items: AdminMedia[], nextCursor }
 *   POST /admin/api/media  (multipart, field "file", one image per request)
 *        → 201 { media: AdminMedia } | 4xx/500 { error: "<message from admin.media.errors>" }
 *
 * The upload body is streamed to the backend as it arrives (never buffered: request.formData()
 * would read bodies of any size), cut off at the size limit.
 */

export async function GET(request: Request): Promise<Response> {
  const denied = await requireAdminRoute(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const result = await listMediaPage({ cursor: url.searchParams.get('cursor'), q: url.searchParams.get('q') });
  if (!result.ok) return mediaReadFailure('listMedia', result.failure);
  return mediaJson({ items: result.data.items, nextCursor: result.data.nextCursor });
}

export async function POST(request: Request): Promise<Response> {
  const denied = await requireAdminRoute(request);
  if (denied) return denied;
  const contentType = request.headers.get('content-type') ?? '';
  const contentLength = declaredLength(request);
  if (contentLength !== null && contentLength > MAX_UPLOAD_BODY_BYTES) return mediaUploadFailure(UPLOAD_TOO_LARGE);
  if (!request.body || !/^multipart\/form-data\s*;/i.test(contentType)) return notMultipart(contentType);
  const result = await uploadMediaStream({ body: request.body, contentType, contentLength, signal: request.signal });
  if (!result.ok) return mediaUploadFailure(result.failure);
  return mediaJson({ media: result.data }, 201);
}

/** A form without a file part (urlencoded) → «Файл не передан»; anything else → «Не удалось прочитать файл…». */
async function notMultipart(contentType: string): Promise<Response> {
  const isUrlEncoded = /^application\/x-www-form-urlencoded\b/i.test(contentType);
  const key = isUrlEncoded ? 'admin.media.errors.noFile' : 'admin.media.errors.unreadable';
  return mediaJson({ error: await translateAdminMessage({ key }) }, 400);
}

function declaredLength(request: Request): number | null {
  const value = Number(request.headers.get('content-length') ?? '');
  return request.headers.has('content-length') && Number.isFinite(value) ? value : null;
}
