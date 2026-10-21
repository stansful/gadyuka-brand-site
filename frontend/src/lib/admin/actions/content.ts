'use server';

import { unstable_rethrow } from 'next/navigation';

import type { Locale } from '@/i18n/locales';
import { adminRequest } from '@/lib/api/admin';
import { describeAdminFailure, translateAdminMessage } from '@/lib/api/admin-messages';
import { describeFailure, isOutcomeUnknown, type ApiFailure, type ApiResult } from '@/lib/api/api-result';
import { markContentStale, revalidateContent } from '@/lib/content/cache';
import type {
  SiteTextResetResponse,
  SiteTextsSaveRequest,
  SiteTextsSaveResponse,
  SiteTextsWriteTimeoutMs,
} from '@shared/contracts/site-texts';

import { actionFail, actionOk, type ActionFailure, type ActionResult } from '../action-result';
import { getAdminTranslations } from '../i18n-server';
import { parseSiteTextConflicts, siteTextConflictFailure } from '../site-text-save';
import { siteTextLabels } from '../site-texts';

/**
 * «Тексты сайта» — Server Actions over the backend (PUT /api/v1/admin/site-texts, POST …/reset,
 * shared/contracts/site-texts.ts): the backend validates, checks conflicts under its lock, writes the
 * Message / ContentImage rows and drops its message cache; a write that changed something then
 * refreshes the public site here (revalidateContent → the "content" cache tag, next-intl's messages
 * included). Failures come back as the editor's form errors:
 * - the texts themselves (400, form message under ""): «Исправьте ошибки в текстах» + "<key>.<locale>";
 * - a request the backend refuses by shape (400): «Проверьте поля формы» + "entries.<i>…" (content-errors.ts);
 * - a conflict (409): «Ничего не сохранено: … уже изменили …» + the stored text per field (site-text-save.ts).
 */

/**
 * How long a save / reset may take (shared/contracts/site-texts.ts SiteTextsWriteTimeoutMs), instead of
 * the client's default ApiRequestTimeoutMs: the backend runs it in one transaction under the «Тексты
 * сайта» lock — up to 5 s waiting for a connection and 30 s of work (backend site-texts.store.ts) — plus
 * the checks around it. Giving up earlier tells the admin «не удалось» about a save that still commits.
 */
const SITE_TEXTS_WRITE_TIMEOUT_MS: SiteTextsWriteTimeoutMs = 45_000;

/** What the editor shows after a save: the stored value of every submitted text and language. */
export type SavedSiteTexts = SiteTextsSaveResponse;

/** Saves the texts (and landing images) the editor changed; only what changes is written. */
export async function saveSiteTexts(input: SiteTextsSaveRequest): Promise<ActionResult<SavedSiteTexts>> {
  return runSiteTextsAction(
    'saveSiteTexts',
    () =>
      adminRequest<SiteTextsSaveResponse>('/api/v1/admin/site-texts', {
        method: 'PUT',
        body: input,
        timeoutMs: SITE_TEXTS_WRITE_TIMEOUT_MS,
      }),
    {
      onSuccess: async data => {
        const t = await getAdminTranslations('admin.siteTexts');
        if (data.saved === 0) return actionOk(data, t('noChanges'));
        revalidateContent();
        return actionOk(data, t('saved'));
      },
      onFailure: saveFailure,
    },
  );
}

/**
 * «Вернуть по умолчанию»: every locale of `key` gets its shared/messages/<locale>.json value back, with
 * editedAt = null (the seed keeps such rows in sync with newer defaults).
 */
export async function resetSiteText(key: string): Promise<ActionResult<{ values: Record<Locale, string> }>> {
  return runSiteTextsAction(
    'resetSiteText',
    () =>
      adminRequest<SiteTextResetResponse>('/api/v1/admin/site-texts/reset', {
        method: 'POST',
        body: { key },
        timeoutMs: SITE_TEXTS_WRITE_TIMEOUT_MS,
      }),
    {
      onSuccess: async data => {
        revalidateContent();
        const t = await getAdminTranslations('admin.siteTexts');
        return actionOk({ values: { ...data.values } }, t('resetDone'));
      },
      onFailure: resetFailure,
    },
  );
}

type SiteTextsActionHandlers<T, R> = {
  readonly onSuccess: (data: T) => Promise<ActionResult<R>>;
  readonly onFailure: (failure: ApiFailure) => Promise<ActionFailure>;
};

/**
 * The body of the two actions (adminApiAction with the editor's own failures): a backend failure goes to
 * `onFailure`; an unreachable backend or an unexpected throw is logged and answered «Не удалось выполнить
 * действие»; Next.js control flow (redirect) is re-thrown. Both actions write public content: when their
 * outcome is unknown (no usable answer, a 5xx, a throw) the site's cache is marked stale, as in adminApiAction.
 */
async function runSiteTextsAction<T, R>(
  label: string,
  request: () => Promise<ApiResult<T>>,
  handlers: SiteTextsActionHandlers<T, R>,
): Promise<ActionResult<R>> {
  try {
    const result = await request();
    if (result.ok) return await handlers.onSuccess(result.data);
    if (result.failure.kind === 'unavailable')
      console.error(`[admin] action "${label}": ${describeFailure(result.failure)}`);
    if (isOutcomeUnknown(result.failure)) markContentStale();
    return await handlers.onFailure(result.failure);
  } catch (error: unknown) {
    unstable_rethrow(error);
    console.error(`[admin] action "${label}" failed:`, error);
    markContentStale();
    return actionFail(await translateAdminMessage({ key: 'admin.errors.actionFailed' }));
  }
}

/** The conflict names the texts changed elsewhere; a refusal of the texts carries its form message under "". */
async function saveFailure(failure: ApiFailure): Promise<ActionFailure> {
  if (failure.kind === 'domain' && failure.error === 'conflict' && failure.message.key === CONFLICT_KEY) {
    const [t, tErrors] = await Promise.all([
      getAdminTranslations('admin.siteTexts'),
      getAdminTranslations('admin.siteTexts.errors'),
    ]);
    const conflict = siteTextConflictFailure(parseSiteTextConflicts(failure.details), siteTextLabels(t), tErrors);
    return actionFail(conflict.message, conflict.fieldErrors);
  }
  const { error, fieldErrors = {} } = await describeAdminFailure(failure);
  const { [FORM_FIELD]: formMessage, ...fields } = fieldErrors;
  return actionFail(formMessage ?? error, fields);
}

/** A reset has no form: the refusal is one message («Этого текста больше нет на сайте…»). */
async function resetFailure(failure: ApiFailure): Promise<ActionFailure> {
  const { error, fieldErrors = {} } = await describeAdminFailure(failure);
  return actionFail(Object.values(fieldErrors)[0] ?? error);
}

const CONFLICT_KEY = 'admin.siteTexts.errors.conflict';
/** describeAdminFailure's field of the request as a whole (the backend's "" path). */
const FORM_FIELD = '_form';
