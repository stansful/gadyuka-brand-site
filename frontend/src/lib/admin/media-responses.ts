import 'server-only';
import { translateAdminMessage } from '@/lib/api/admin-messages';
import { describeFailure, type ApiFailure } from '@/lib/api/api-result';

/**
 * Answers of the admin media routes (src/app/admin/api/media): JSON, never cached; errors are
 * { error: "<the admin's text>" } — what the media dialogs show (src/components/admin/media/media-api.ts).
 */

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

const SERVER_ERROR_STATUS = 500;

export function mediaJson(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

/**
 * A failed read (library page, details): a client error of the backend → its text with its status
 * (a malformed cursor or id, a missing file, an ended session); an outage or a server error → a
 * bare 500 (the dialogs show «Ошибка сервера (500)»), logged.
 */
export async function mediaReadFailure(label: string, failure: ApiFailure): Promise<Response> {
  const text = await clientErrorText(failure);
  if (text !== null) return mediaJson({ error: text }, failure.status ?? SERVER_ERROR_STATUS);
  console.error(`[admin] media "${label}": ${describeFailure(failure)}`);
  return mediaJson({}, SERVER_ERROR_STATUS);
}

/** A failed upload: a client error → its text (413 tooLarge, 415 unsupported …); anything else → «Не удалось сохранить файл». */
export async function mediaUploadFailure(failure: ApiFailure): Promise<Response> {
  const text = await clientErrorText(failure);
  if (text !== null) return mediaJson({ error: text }, failure.status ?? SERVER_ERROR_STATUS);
  console.error(`[admin] media upload failed: ${describeFailure(failure)}`);
  return mediaJson(
    { error: await translateAdminMessage({ key: 'admin.media.errors.saveFailed' }) },
    SERVER_ERROR_STATUS,
  );
}

/** The admin's text of a client error (4xx) of the backend; null for an outage or a server error. */
async function clientErrorText(failure: ApiFailure): Promise<string | null> {
  if (failure.kind === 'unavailable' || failure.status >= SERVER_ERROR_STATUS) return null;
  if (failure.kind === 'domain') return translateAdminMessage(failure.message);
  const [first] = Object.values(failure.fields);
  return translateAdminMessage(first ?? { key: 'admin.errors.invalidRequest' });
}
