import 'server-only';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MEGABYTES } from '@/lib/admin/media-constants';
import type { LocalizedText } from '@shared/contracts/common';
import type { MediaAltResponse, MediaDetailsResponse, MediaItem, MediaListResponse } from '@shared/contracts/media';

import type { ApiFailure, ApiResult } from './api-result';

import { adminRequest, getAccessToken } from './admin';
import { readBackendEnv } from './backend-env';
import { failureOf, setVisitorHeaders, type ApiPath } from './client';
import { getVisitor } from './visitor';

/**
 * The admin media library through the backend (/api/v1/admin/media, shared/contracts/media.ts):
 * pages of files, details with the places that use a file, alt text, delete — and uploads, whose
 * multipart body is streamed to the backend as it arrives (never buffered here).
 */

const MEDIA_PATH = '/api/v1/admin/media' satisfies ApiPath;

/** Multipart overhead allowance on top of the file limit (hard cap, enforced while streaming). */
export const MAX_UPLOAD_BODY_BYTES = MAX_UPLOAD_BYTES + 512 * 1024;

/**
 * An upload streams at the visitor's pace (the backend reads while the browser sends): 15 MB over a
 * slow mobile link takes minutes. The visitor going away aborts it earlier.
 */
const UPLOAD_TIMEOUT_MS = 15 * 60 * 1000;

/** What the backend answers to a file over the limit — also when this server cuts the body off. */
export const UPLOAD_TOO_LARGE: ApiFailure = {
  kind: 'domain',
  status: 413,
  error: 'payloadTooLarge',
  message: { key: 'admin.media.errors.tooLarge', values: { size: MAX_UPLOAD_MEGABYTES } },
};

const TOO_LARGE: ApiResult<never> = { ok: false, failure: UPLOAD_TOO_LARGE };

const SESSION_REQUIRED: ApiFailure = {
  kind: 'domain',
  status: 401,
  error: 'unauthorized',
  message: { key: 'admin.auth.sessionRequired' },
};

/** Newest first, 60 per page; `cursor` = nextCursor of the previous page, `q` searches the file names. */
export function listMediaPage(query: {
  cursor?: string | null;
  q?: string | null;
}): Promise<ApiResult<MediaListResponse>> {
  return adminRequest<MediaListResponse>(MEDIA_PATH, { query: { cursor: query.cursor || null, q: query.q } });
}

export function getMediaDetails(id: string): Promise<ApiResult<MediaDetailsResponse>> {
  return adminRequest<MediaDetailsResponse>(`${MEDIA_PATH}/${encodeURIComponent(id)}`);
}

export function saveMediaAlt(id: string, alt: LocalizedText): Promise<ApiResult<MediaAltResponse>> {
  return adminRequest<MediaAltResponse>(`${MEDIA_PATH}/${encodeURIComponent(id)}/alt`, {
    method: 'PATCH',
    body: { alt },
  });
}

/** 204 when deleted; 409 admin.media.errors.inUse while the file is used somewhere. */
export function deleteMediaFile(id: string): Promise<ApiResult<void>> {
  return adminRequest<void>(`${MEDIA_PATH}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export type MediaUploadRequest = {
  /** The multipart/form-data body of the browser, as it arrives */
  readonly body: ReadableStream<Uint8Array>;
  /** Its Content-Type (with the boundary) */
  readonly contentType: string;
  /** Its declared Content-Length, when there is one */
  readonly contentLength: number | null;
  /** Aborts the upload (the visitor went away) */
  readonly signal?: AbortSignal;
};

/**
 * POST /api/v1/admin/media with the browser's multipart body streamed through, cut off at
 * MAX_UPLOAD_BODY_BYTES (a declared larger body is refused before anything is sent).
 */
export async function uploadMediaStream(upload: MediaUploadRequest): Promise<ApiResult<MediaItem>> {
  if (upload.contentLength !== null && upload.contentLength > MAX_UPLOAD_BODY_BYTES) return TOO_LARGE;
  const limited = limitBodyBytes(upload.body, MAX_UPLOAD_BODY_BYTES);
  const result = await postUpload({ ...upload, body: limited.body });
  return limited.exceeded() ? TOO_LARGE : result;
}

/** The stream with a byte counter that errors the stream once more than `maxBytes` went through. */
function limitBodyBytes(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
): { body: ReadableStream<Uint8Array>; exceeded: () => boolean } {
  let total = 0;
  let over = false;
  const counter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      total += chunk.byteLength;
      if (total <= maxBytes) {
        controller.enqueue(chunk);
        return;
      }
      over = true;
      controller.error(new Error('Upload body too large'));
    },
  });
  return { body: body.pipeThrough(counter), exceeded: () => over };
}

async function postUpload(upload: MediaUploadRequest): Promise<ApiResult<MediaItem>> {
  const config = readBackendEnv();
  if (!config.ok) return { ok: false, failure: { kind: 'unavailable', status: null, reason: 'config' } };
  const accessToken = await getAccessToken();
  if (!accessToken) return { ok: false, failure: SESSION_REQUIRED };
  const headers = await uploadHeaders(config.env.internalKey, accessToken, upload.contentType);
  const timeout = AbortSignal.timeout(UPLOAD_TIMEOUT_MS);
  // Node's fetch sends a stream body only in half-duplex mode (not in the DOM RequestInit type);
  // no-store keeps Next's fetch cache away from the body.
  const init: RequestInit & { duplex: 'half' } = {
    method: 'POST',
    headers,
    body: upload.body,
    duplex: 'half',
    cache: 'no-store',
    signal: upload.signal ? AbortSignal.any([upload.signal, timeout]) : timeout,
    redirect: 'manual',
  };
  try {
    return await readUploadResponse(await fetch(new URL(MEDIA_PATH, config.env.backendUrl), init));
  } catch (error: unknown) {
    const reason = error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'network';
    return { ok: false, failure: { kind: 'unavailable', status: null, reason } };
  }
}

async function uploadHeaders(internalKey: string, accessToken: string, contentType: string): Promise<Headers> {
  const visitor = await getVisitor();
  const headers = new Headers({
    accept: 'application/json',
    'content-type': contentType,
    'x-internal-key': internalKey,
    authorization: `Bearer ${accessToken}`,
  });
  setVisitorHeaders(headers, visitor);
  return headers;
}

async function readUploadResponse(response: Response): Promise<ApiResult<MediaItem>> {
  const text = await response.text();
  const isJson = (response.headers.get('content-type') ?? '').includes('application/json');
  let body: unknown;
  try {
    body = isJson && text !== '' ? JSON.parse(text) : undefined;
  } catch {
    return { ok: false, failure: { kind: 'unavailable', status: response.status, reason: 'badResponse' } };
  }
  if (response.ok && body !== undefined) {
    // The shape is the backend's contract (shared/contracts/media.ts).
    return { ok: true, status: response.status, data: body as MediaItem };
  }
  return { ok: false, failure: failureOf(response.status, body) };
}
