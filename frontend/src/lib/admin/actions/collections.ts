'use server';

import { adminRequest } from '@/lib/api/admin';
import { adminApiAction, type DomainFieldErrors } from '@/lib/api/admin-action';
import { translateAdminMessage } from '@/lib/api/admin-messages';
import type { AdminCatalogRowSaved, AdminCollectionSaveRequest } from '@shared/contracts/catalog';

import { actionOk, type ActionResult } from '../action-result';

/** Refusals of the backend shown at their field too (as the old action did). */
const REFUSALS: DomainFieldErrors = {
  'admin.errors.slugTaken': { field: 'slug', key: 'admin.collections.slugTaken' },
  'admin.errors.missingMedia': { field: 'coverId', key: 'admin.errors.missingMedia' },
};

/** Create (id = null) or update a collection: POST /admin/collections, PUT /admin/collections/:id. */
export async function saveCollection(
  id: string | null,
  input: AdminCollectionSaveRequest,
): Promise<ActionResult<{ id: string }>> {
  return adminApiAction(
    'saveCollection',
    () =>
      id === null
        ? adminRequest<AdminCatalogRowSaved>('/api/v1/admin/collections', { method: 'POST', body: input })
        : adminRequest<AdminCatalogRowSaved>(`/api/v1/admin/collections/${encodeURIComponent(id)}`, {
            method: 'PUT',
            body: input,
          }),
    {
      fieldErrors: REFUSALS,
      revalidatesContent: true,
      onSuccess: async data =>
        actionOk(
          { id: data.id },
          await translateAdminMessage({ key: id === null ? 'admin.collections.created' : 'admin.collections.saved' }),
        ),
    },
  );
}
