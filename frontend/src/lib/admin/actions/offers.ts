'use server';

import { adminApiAction } from '@/lib/api/admin-action';
import { translateAdminMessage } from '@/lib/api/admin-messages';
import { saveContentEntity } from '@/lib/api/content-entities';
import type { AdminOfferInput } from '@shared/contracts/content-entities';

import { actionOk, type ActionResult } from '../action-result';

/**
 * Create (id = null: appended to the end of the list) or update a special offer. The backend checks
 * the button link rules (a label needs a link — shown on the link field) and stores the last day
 * until 23:59:59.999 Moscow time.
 */
export async function saveOffer(id: string | null, input: AdminOfferInput): Promise<ActionResult<{ id: string }>> {
  return adminApiAction('saveOffer', () => saveContentEntity('/api/v1/admin/offers', id, input), {
    revalidatesContent: true,
    fieldErrors: {
      'admin.errors.missingMedia': { field: 'imageId' },
      'admin.offers.ctaHrefRequired': { field: 'ctaHref', key: 'admin.offers.ctaHrefRequiredField' },
    },
    onSuccess: async data =>
      actionOk(
        { id: data.id },
        await translateAdminMessage({ key: id === null ? 'admin.offers.created' : 'admin.offers.saved' }),
      ),
  });
}
