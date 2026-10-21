'use server';

import { adminRequest } from '@/lib/api/admin';
import { adminApiAction, type DomainFieldErrors } from '@/lib/api/admin-action';
import { translateAdminMessage } from '@/lib/api/admin-messages';
import type { AdminCatalogRowSaved, AdminReviewSaveRequest } from '@shared/contracts/catalog';

import { actionOk, type ActionResult } from '../action-result';

/** Refusals of the backend shown at their field too (as the old action did). */
const REFUSALS: DomainFieldErrors = {
  // «Оценка {rating} больше шкалы» as the toast, «Оценка от 1 до {max}…» at the stars.
  'admin.reviews.ratingAboveScale': { field: 'rating', key: 'admin.reviews.ratingAboveScaleField' },
  'admin.errors.missingMedia': { field: 'avatarId', key: 'admin.errors.missingMedia' },
};

/**
 * Create (id = null) or update a review: POST /admin/reviews, PUT /admin/reviews/:id. The backend checks
 * the rating against the CURRENT star scale (the form's own copy of it may be stale).
 */
export async function saveReview(
  id: string | null,
  input: AdminReviewSaveRequest,
): Promise<ActionResult<{ id: string }>> {
  return adminApiAction(
    'saveReview',
    () =>
      id === null
        ? adminRequest<AdminCatalogRowSaved>('/api/v1/admin/reviews', { method: 'POST', body: input })
        : adminRequest<AdminCatalogRowSaved>(`/api/v1/admin/reviews/${encodeURIComponent(id)}`, {
            method: 'PUT',
            body: input,
          }),
    {
      fieldErrors: REFUSALS,
      revalidatesContent: true,
      onSuccess: async data =>
        actionOk(
          { id: data.id },
          await translateAdminMessage({ key: id === null ? 'admin.reviews.created' : 'admin.reviews.saved' }),
        ),
    },
  );
}
