import { z } from "zod";
import { parseLocalizedText } from "@/lib/i18n-text";
import { isAcceptedImageMime, MAX_UPLOAD_BYTES, ACCEPTED_FORMATS_LABEL } from "@/lib/admin/media-constants";
import type { AdminMedia, MediaPage, MediaUsage } from "@/lib/admin/types";

/** Browser client of the admin media API (src/app/admin/api/media). Responses are validated with zod. */

const MEDIA_API = "/admin/api/media";

const adminMediaSchema = z.object({
  id: z.string(),
  url: z.string(),
  width: z.number(),
  height: z.number(),
  alt: z.unknown().transform((value) => parseLocalizedText(value)),
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

export class MediaApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaApiError";
  }
}

function errorMessage(body: unknown, status: number): string {
  const parsed = errorResponseSchema.safeParse(body);
  if (parsed.success) return parsed.data.error;
  if (status === 401) return "Сессия истекла — обновите страницу и войдите снова";
  if (status === 413) return "Файл слишком большой";
  return `Ошибка сервера (${status})`;
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { signal, cache: "no-store", credentials: "same-origin" });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new MediaApiError("Нет связи с сервером");
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new MediaApiError(errorMessage(body, response.status));
  return body;
}

export async function fetchMediaPage(options: { cursor?: string | null; query?: string }, signal?: AbortSignal): Promise<MediaPage> {
  const params = new URLSearchParams();
  if (options.cursor) params.set("cursor", options.cursor);
  if (options.query?.trim()) params.set("q", options.query.trim());
  const body = await getJson(`${MEDIA_API}?${params.toString()}`, signal);
  const parsed = mediaPageSchema.safeParse(body);
  if (!parsed.success) throw new MediaApiError("Неожиданный ответ сервера");
  return parsed.data;
}

export async function fetchMediaDetails(id: string, signal?: AbortSignal): Promise<{ media: AdminMedia; usages: MediaUsage[] }> {
  const body = await getJson(`${MEDIA_API}/${encodeURIComponent(id)}`, signal);
  const parsed = mediaDetailsSchema.safeParse(body);
  if (!parsed.success) throw new MediaApiError("Неожиданный ответ сервера");
  return parsed.data;
}

/** Client-side pre-check (the server re-validates by magic bytes). Returns an error message or null. */
export function precheckFile(file: File): string | null {
  if (file.size === 0) return "Файл пустой";
  if (file.size > MAX_UPLOAD_BYTES) return `Файл больше ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} МБ`;
  if (file.type && !isAcceptedImageMime(file.type)) return `Неподдерживаемый формат. Можно: ${ACCEPTED_FORMATS_LABEL}`;
  return null;
}

export type UploadResult = { ok: true; media: AdminMedia } | { ok: false; error: string };

/** Uploads one file with progress (XMLHttpRequest — fetch has no upload progress). */
export function uploadMediaFile(file: File, onProgress?: (fraction: number) => void, signal?: AbortSignal): Promise<UploadResult> {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    request.open("POST", MEDIA_API);
    request.responseType = "json";
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      const body: unknown = request.response;
      if (request.status >= 200 && request.status < 300) {
        const parsed = uploadResponseSchema.safeParse(body);
        resolve(parsed.success ? { ok: true, media: parsed.data.media } : { ok: false, error: "Неожиданный ответ сервера" });
        return;
      }
      resolve({ ok: false, error: errorMessage(body, request.status) });
    };
    request.onerror = () => resolve({ ok: false, error: "Нет связи с сервером" });
    request.onabort = () => resolve({ ok: false, error: "Загрузка отменена" });
    signal?.addEventListener("abort", () => request.abort(), { once: true });

    const form = new FormData();
    form.append("file", file, file.name);
    request.send(form);
  });
}
