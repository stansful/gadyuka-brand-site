'use server';

import { adminRequest } from '@/lib/api/admin';
import { adminApiAction, type DomainFieldErrors } from '@/lib/api/admin-action';
import { translateAdminMessage } from '@/lib/api/admin-messages';
import type { AdminCatalogRowSaved, AdminProductSaveRequest } from '@shared/contracts/catalog';

import { actionOk, type ActionResult } from '../action-result';

/** Refusals of the backend shown at their field too (as the old action did). */
const REFUSALS: DomainFieldErrors = {
  'admin.errors.slugTaken': { field: 'slug', key: 'admin.products.slugTaken' },
  'admin.products.collectionNotFound': { field: 'collectionId', key: 'admin.products.chooseCollection' },
  'admin.errors.missingMedia': { field: 'imageIds', key: 'admin.errors.missingMedia' },
};

/**
 * Create (id = null) or update a product together with its ordered photos: POST /admin/products,
 * PUT /admin/products/:id (a product moved to another collection goes last there).
 */
export async function saveProduct(
  id: string | null,
  input: AdminProductSaveRequest,
): Promise<ActionResult<{ id: string }>> {
  return adminApiAction(
    'saveProduct',
    () =>
      id === null
        ? adminRequest<AdminCatalogRowSaved>('/api/v1/admin/products', { method: 'POST', body: input })
        : adminRequest<AdminCatalogRowSaved>(`/api/v1/admin/products/${encodeURIComponent(id)}`, {
            method: 'PUT',
            body: input,
          }),
    {
      fieldErrors: REFUSALS,
      revalidatesContent: true,
      onSuccess: async data =>
        actionOk(
          { id: data.id },
          await translateAdminMessage({ key: id === null ? 'admin.products.created' : 'admin.products.saved' }),
        ),
    },
  );
}
