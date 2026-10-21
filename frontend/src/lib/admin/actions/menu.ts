'use server';

import { adminApiAction } from '@/lib/api/admin-action';
import { translateAdminMessage } from '@/lib/api/admin-messages';
import { saveContentEntity } from '@/lib/api/content-entities';
import type { AdminMenuItemInput } from '@shared/contracts/content-entities';

import { actionOk, type ActionResult } from '../action-result';

/**
 * Create (id = null) or update a site menu item. A new item goes to the end of the menu;
 * the order, the publish toggle and deleting are the shared list actions (./entities.ts).
 */
export async function saveMenuItem(
  id: string | null,
  input: AdminMenuItemInput,
): Promise<ActionResult<{ id: string }>> {
  return adminApiAction('saveMenuItem', () => saveContentEntity('/api/v1/admin/menu-items', id, input), {
    revalidatesContent: true,
    onSuccess: async data =>
      actionOk(
        { id: data.id },
        await translateAdminMessage({ key: id === null ? 'admin.menu.created' : 'admin.menu.saved' }),
      ),
  });
}
