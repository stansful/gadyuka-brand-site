'use server';

import { adminApiAction } from '@/lib/api/admin-action';
import { translateAdminMessage } from '@/lib/api/admin-messages';
import { saveContentEntity } from '@/lib/api/content-entities';
import type { AdminPartnerInput } from '@shared/contracts/content-entities';

import { actionOk, type ActionResult } from '../action-result';

/** Create (id = null: appended to the end of the list) or update a partner. */
export async function savePartner(id: string | null, input: AdminPartnerInput): Promise<ActionResult<{ id: string }>> {
  return adminApiAction('savePartner', () => saveContentEntity('/api/v1/admin/partners', id, input), {
    revalidatesContent: true,
    fieldErrors: { 'admin.errors.missingMedia': { field: 'logoId' } },
    onSuccess: async data =>
      actionOk(
        { id: data.id },
        await translateAdminMessage({ key: id === null ? 'admin.partners.created' : 'admin.partners.saved' }),
      ),
  });
}
