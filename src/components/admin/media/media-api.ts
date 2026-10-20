import { z } from 'zod';

import type { AdminTranslator } from '@/lib/admin/i18n';
import {
  ACCEPTED_FORMATS_LABEL,
  isAcceptedImageMime,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_MEGABYTES,
} from '@/lib/admin/media-constants';
import type { AdminMedia, MediaPage, MediaUsage } from '@/lib/admin/types';
import { parseLocalizedText } from '@/lib/i18n-text';

/**
 * Browser client of the admin media API (src/app/admin/api/media). Responses are validated
 * with zod. Failures are MediaProblems: the server's own (already translated) error text, or
 * a key of admin.media.errors for what the browser detects itself — the components turn them
 * into text with mediaProblemText().
 */

const MEDIA_API = '/admin/api/media';

const adminMediaSchema = z.object({
  id: z.string(),
  url: z.string(),
  width: z.number(),
  height: z.number(),
  alt: z.unknown().transform(value => parseLocalizedText(value)),
  mime: z.string(),
  size: z.number(),
  originalName: z.string().nullable(),
  createdAt: z.string(),
  usageCount: z.number(),
});

const mediaPageSchema = z.object({ items: z.array(adminMediaSchema), nextCursor: z.string().nullable() });
const mediaUsageSchema = z.object({ kind: z.string(), title: z.string(), href: z.string() });
const mediaDetailsSchema = z.object({ media: adminMediaSchema, usages: z.array(mediaUsageSchema) });
const uploadResponseSchema = z.object({ media: adminMediaSchema });
const errorResponseSchema = z.object({ error: z.string() });

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
  const parsed = errorResponseSchema.safeParse(body);
  if (parsed.success) return { text: parsed.data.error };
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
  const parsed = mediaPageSchema.safeParse(body);
  if (!parsed.success) throw new MediaApiError({ key: 'unexpected' });
  return parsed.data;
}

export async function fetchMediaDetails(
  id: string,
  signal?: AbortSignal,
): Promise<{ media: AdminMedia; usages: MediaUsage[] }> {
  const body = await getJson(`${MEDIA_API}/${encodeURIComponent(id)}`, signal);
  const parsed = mediaDetailsSchema.safeParse(body);
  if (!parsed.success) throw new MediaApiError({ key: 'unexpected' });
  return parsed.data;
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
        const parsed = uploadResponseSchema.safeParse(body);
        resolve(
          parsed.success ? { ok: true, media: parsed.data.media } : { ok: false, problem: { key: 'unexpected' } },
        );
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
