import 'server-only';
import { unstable_rethrow } from 'next/navigation';

import { actionFail, type ActionResult, type FieldErrors } from '@/lib/admin/action-result';
import { markContentStale, revalidateContent } from '@/lib/content/cache';

import { describeAdminFailure, translateAdminMessage } from './admin-messages';
import { describeFailure, isOutcomeUnknown, type ApiFailure, type ApiResult } from './api-result';

/**
 * Domain refusals (by their message key) a form also shows at a field: «Адрес уже занят» under the
 * slug, «Выбранное изображение не найдено…» under the picker. `key`: the field's own message (default:
 * the form message); it gets the refusal's ICU values ({ rating, max } …).
 */
export type DomainFieldErrors = Readonly<Record<string, { readonly field: string; readonly key?: string }>>;

export type AdminApiActionOptions<T, R> = {
  /**
   * The write changed what the public site shows: refresh the site's cache after a success
   * (updateTag('content') — read-your-own-writes on the next request), and mark it stale when the
   * outcome is unknown (see below). Default false.
   */
  readonly revalidatesContent?: boolean;
  /** Builds the success result (usually actionOk(data, t('saved'))). */
  readonly onSuccess: (data: T) => ActionResult<R> | Promise<ActionResult<R>>;
  /** Domain refusals shown at a field too (see DomainFieldErrors). */
  readonly fieldErrors?: DomainFieldErrors;
};

/**
 * The body of an admin Server Action that calls the backend:
 *
 *   export async function saveCollection(id: string, input: CollectionInput): Promise<ActionResult<{ id: string }>> {
 *     return adminApiAction(
 *       'saveCollection',
 *       () => adminRequest<CollectionSaved>(`/api/v1/admin/collections/${id}`, { method: 'PUT', body: input }),
 *       { revalidatesContent: true, onSuccess: async data => actionOk({ id: data.id }, await translateAdminMessage({ key: 'admin.collections.saved' })) },
 *     );
 *   }
 *
 * - success → `updateTag('content')` when `revalidatesContent`, then `onSuccess(data)`;
 * - no usable answer (timeout, reset connection, a proxy's error page) or an unexpected throw: the
 *   write may have landed although the admin is told it failed — with `revalidatesContent` the
 *   site's cache is marked stale (markContentStale), so the site does not keep the old copy for
 *   the hour of its cache life;
 * - 400 validation → ActionFailure «Проверьте поля формы» + fieldErrors keyed by the backend's dotted
 *   paths ("slug", "title.en"), each translated from its admin.validation.* key with its values;
 * - 401 → «Сессия истекла…»; any other error → its translated key (admin.errors.notFound …), also at
 *   its field when `fieldErrors` lists its key;
 * - backend unavailable or an unexpected throw → logged, «Не удалось выполнить действие»;
 * - Next.js control flow (redirect, notFound) is re-thrown.
 * Access: the backend checks the session and the role on every call (the access cookie is sent by
 * adminRequest); a missing / expired session comes back as the 401 above.
 */
export async function adminApiAction<T, R>(
  label: string,
  request: () => Promise<ApiResult<T>>,
  options: AdminApiActionOptions<T, R>,
): Promise<ActionResult<R>> {
  try {
    const result = await request();
    if (!result.ok) {
      if (result.failure.kind === 'unavailable')
        console.error(`[admin] action "${label}": ${describeFailure(result.failure)}`);
      if (options.revalidatesContent && isOutcomeUnknown(result.failure)) markContentStale();
      const { error, fieldErrors } = await describeAdminFailure(result.failure);
      return actionFail(error, {
        ...fieldErrors,
        ...(await domainFieldError(result.failure, error, options.fieldErrors)),
      });
    }
    if (options.revalidatesContent) revalidateContent();
    return await options.onSuccess(result.data);
  } catch (error: unknown) {
    unstable_rethrow(error);
    console.error(`[admin] action "${label}" failed:`, error);
    if (options.revalidatesContent) markContentStale();
    return actionFail(await translateAdminMessage({ key: 'admin.errors.actionFailed' }));
  }
}

/** The field message of a domain refusal listed in `fieldErrors` ({} for any other failure). */
async function domainFieldError(
  failure: ApiFailure,
  formMessage: string,
  fieldErrors: DomainFieldErrors | undefined,
): Promise<FieldErrors> {
  if (failure.kind !== 'domain') return {};
  const target = fieldErrors?.[failure.message.key];
  if (!target) return {};
  const message = target.key
    ? await translateAdminMessage({ key: target.key, values: failure.message.values })
    : formMessage;
  return { [target.field]: message };
}
