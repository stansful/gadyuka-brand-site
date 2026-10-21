import type { AdminTranslator } from '@/lib/admin/i18n';
import {
  ACCEPTED_FORMATS_LABEL,
  isAcceptedImageMime,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_MEGABYTES,
} from '@/lib/admin/media-constants';
import { parseLocalizedText } from '@/lib/localized-text';

import type { AdminMedia, MediaPage, MediaUsageView } from './media-types';

/**
 * Browser client of the admin media API (src/app/admin/api/media). Responses are checked by the
 * small parsers below (a malformed body is the «unexpected» problem). Failures are
 * MediaProblems: the server's own (already translated) error text, or a key of
 * admin.media.errors for what the browser detects itself — the components turn them into text
 * with mediaProblemText().
 */

const MEDIA_API = '/admin/api/media';

// ── response parsers (dependency-free: hand-written checks of the route answers) ──

type JsonObject = { readonly [key: string]: unknown };

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asObject(value: unknown): JsonObject | null {
  return isJsonObject(value) ? value : null;
}

const isText = (value: unknown): value is string => typeof value === 'string';
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Every item parsed, or null when one of them (or the value itself) is malformed. */
function parseList<T>(value: unknown, parseItem: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const out: T[] = [];
  for (const item of value) {
    const parsed = parseItem(item);
    if (parsed === null) return null;
    out.push(parsed);
  }
  return out;
}

function parseAdminMedia(value: unknown): AdminMedia | null {
  const media = asObject(value);
  if (!media) return null;
  const { id, url, width, height, alt, mime, size, originalName, createdAt, usageCount } = media;
  if (!isText(id) || !isText(url) || !isText(mime) || !isText(createdAt)) return null;
  if (!isFiniteNumber(width) || !isFiniteNumber(height) || !isFiniteNumber(size) || !isFiniteNumber(usageCount)) {
    return null;
  }
  if (originalName !== null && !isText(originalName)) return null;
  return { id, url, width, height, alt: parseLocalizedText(alt), mime, size, originalName, createdAt, usageCount };
}

function parseMediaUsage(value: unknown): MediaUsageView | null {
  const usage = asObject(value);
  if (!usage) return null;
  const { kind, title, href } = usage;
  return isText(kind) && isText(title) && isText(href) ? { kind, title, href } : null;
}

function parseMediaPage(value: unknown): MediaPage | null {
  const page = asObject(value);
  if (!page) return null;
  const items = parseList(page.items, parseAdminMedia);
  const { nextCursor } = page;
  if (!items || (nextCursor !== null && !isText(nextCursor))) return null;
  return { items, nextCursor };
}

function parseMediaDetails(value: unknown): { media: AdminMedia; usages: MediaUsageView[] } | null {
  const details = asObject(value);
  if (!details) return null;
  const media = parseAdminMedia(details.media);
  const usages = parseList(details.usages, parseMediaUsage);
  return media && usages ? { media, usages } : null;
}

/** `{ error: "…" }` — the server's own (translated) error text. */
function errorText(value: unknown): string | null {
  const error = asObject(value)?.error;
  return isText(error) ? error : null;
}

type MediaErrorsTranslator = AdminTranslator<'admin.media.errors'>;

export type MediaProblem =
  | { text: string }
  | { key: Parameters<MediaErrorsTranslator>[0]; values?: Record<string, string | number> };

/** The text of a MediaProblem (t = useTranslations('admin.media.errors')). */
export function mediaProblemText(problem: MediaProblem, t: MediaErrorsTranslator): string {
  return 'text' in problem ? problem.text : t(problem.key, problem.values);
}

export class MediaApiError extends Error {
  readonly problem: MediaProblem;

  constructor(problem: MediaProblem) {
    super('text' in problem ? problem.text : problem.key);
    this.name = 'MediaApiError';
    this.problem = problem;
  }
}

function responseProblem(body: unknown, status: number): MediaProblem {
  const text = errorText(body);
  if (text !== null) return { text };
  if (status === 401) return { key: 'sessionExpired' };
  if (status === 413) return { key: 'fileTooLarge' };
  return { key: 'server', values: { status } };
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { signal, cache: 'no-store', credentials: 'same-origin' });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new MediaApiError({ key: 'network' });
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new MediaApiError(responseProblem(body, response.status));
  return body;
}

export async function fetchMediaPage(
  options: { cursor?: string | null; query?: string },
  signal?: AbortSignal,
): Promise<MediaPage> {
  const params = new URLSearchParams();
  if (options.cursor) params.set('cursor', options.cursor);
  if (options.query?.trim()) params.set('q', options.query.trim());
  const body = await getJson(`${MEDIA_API}?${params.toString()}`, signal);
  const page = parseMediaPage(body);
  if (!page) throw new MediaApiError({ key: 'unexpected' });
  return page;
}

export async function fetchMediaDetails(
  id: string,
  signal?: AbortSignal,
): Promise<{ media: AdminMedia; usages: MediaUsageView[] }> {
  const body = await getJson(`${MEDIA_API}/${encodeURIComponent(id)}`, signal);
  const details = parseMediaDetails(body);
  if (!details) throw new MediaApiError({ key: 'unexpected' });
  return details;
}

/** Client-side pre-check (the server re-validates by magic bytes). Null = fine. */
export function precheckFile(file: File): MediaProblem | null {
  if (file.size === 0) return { key: 'empty' };
  if (file.size > MAX_UPLOAD_BYTES) return { key: 'tooLarge', values: { size: MAX_UPLOAD_MEGABYTES } };
  if (file.type && !isAcceptedImageMime(file.type)) {
    return { key: 'unsupported', values: { formats: ACCEPTED_FORMATS_LABEL } };
  }
  return null;
}

export type UploadResult = { ok: true; media: AdminMedia } | { ok: false; problem: MediaProblem };

/** Uploads one file with progress (XMLHttpRequest — fetch has no upload progress). */
export function uploadMediaFile(
  file: File,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<UploadResult> {
  return new Promise(resolve => {
    const request = new XMLHttpRequest();
    request.open('POST', MEDIA_API);
    request.responseType = 'json';
    request.upload.onprogress = event => {
      if (event.lengthComputable && onProgress) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      const body: unknown = request.response;
      if (request.status >= 200 && request.status < 300) {
        const media = parseAdminMedia(asObject(body)?.media);
        resolve(media ? { ok: true, media } : { ok: false, problem: { key: 'unexpected' } });
        return;
      }
      resolve({ ok: false, problem: responseProblem(body, request.status) });
    };
    request.onerror = () => resolve({ ok: false, problem: { key: 'network' } });
    request.onabort = () => resolve({ ok: false, problem: { key: 'aborted' } });
    signal?.addEventListener('abort', () => request.abort(), { once: true });

    const form = new FormData();
    form.append('file', file, file.name);
    request.send(form);
  });
}
