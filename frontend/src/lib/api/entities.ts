import 'server-only';
import { actionOk, type ActionResult } from '@/lib/admin/action-result';
import type { EntityPublishedResponse, OrderableEntityKind, PublishableEntityKind } from '@shared/contracts/entities';

import type { ApiResult } from './api-result';

import { adminRequest } from './admin';
import { adminApiAction } from './admin-action';
import { translateAdminMessage } from './admin-messages';

/**
 * The shared list operations of the admin lists through the backend (/api/v1/admin/entities/*,
 * shared/contracts/entities.ts): publish toggle, drag & drop order, delete. Each refreshes the
 * public site's cache on success and answers with the admin's toast text. Called by the Server
 * Actions of src/lib/admin/actions/entities.ts for the kinds listed in ./entity-sources.ts.
 */

export async function setEntityPublished(
  kind: PublishableEntityKind,
  id: string,
  published: boolean,
): Promise<ActionResult> {
  return adminApiAction(
    'setPublished',
    () =>
      withListMessage(
        adminRequest<EntityPublishedResponse>(`/api/v1/admin/entities/${kind}/${encodeURIComponent(id)}/published`, {
          method: 'PATCH',
          body: { published },
        }),
        INVALID_REQUEST,
      ),
    {
      revalidatesContent: true,
      onSuccess: async data =>
        actionOk(
          null,
          await translateAdminMessage({ key: data.published ? 'admin.entities.published' : 'admin.entities.hidden' }),
        ),
    },
  );
}

export async function reorderEntities(kind: OrderableEntityKind, ids: readonly string[]): Promise<ActionResult> {
  return adminApiAction(
    'reorderItems',
    () =>
      withListMessage(
        adminRequest<void>(`/api/v1/admin/entities/${kind}/reorder`, { method: 'POST', body: { ids } }),
        'admin.entities.invalidOrder',
      ),
    {
      revalidatesContent: true,
      onSuccess: async () => actionOk(null, await translateAdminMessage({ key: 'admin.entities.orderSaved' })),
    },
  );
}

export async function deleteEntity(kind: PublishableEntityKind, id: string): Promise<ActionResult> {
  return adminApiAction(
    'deleteItem',
    () =>
      withListMessage(
        adminRequest<void>(`/api/v1/admin/entities/${kind}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
        INVALID_REQUEST,
      ),
    {
      revalidatesContent: true,
      onSuccess: async () => actionOk(null, await translateAdminMessage({ key: `admin.entities.deleted.${kind}` })),
    },
  );
}

const INVALID_REQUEST = 'admin.errors.invalidRequest';

/**
 * A list has no form fields: a request the backend refuses as invalid (a stale or tampered id, kind or
 * order) shows one toast with the message the old actions showed — «Некорректный запрос» /
 * «Некорректный порядок» — instead of «Проверьте поля формы» with field errors.
 */
async function withListMessage<T>(request: Promise<ApiResult<T>>, key: string): Promise<ApiResult<T>> {
  const result = await request;
  if (result.ok || result.failure.kind !== 'validation') return result;
  return {
    ok: false,
    failure: { kind: 'domain', status: result.failure.status, error: 'badRequest', message: { key } },
  };
}
