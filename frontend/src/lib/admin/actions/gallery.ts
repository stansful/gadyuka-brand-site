'use server';

import { adminRequest } from '@/lib/api/admin';
import { adminApiAction } from '@/lib/api/admin-action';
import { translateAdminMessage } from '@/lib/api/admin-messages';
import { saveContentEntity } from '@/lib/api/content-entities';
import type {
  AdminGalleryBulkAdded,
  AdminGalleryBulkInput,
  AdminGalleryItemInput,
} from '@shared/contracts/content-entities';

import { actionOk, type ActionResult } from '../action-result';

const GALLERY_PATH = '/api/v1/admin/gallery';

/** Create (id = null: appended to the end of the gallery) or update a gallery item. */
export async function saveGalleryItem(
  id: string | null,
  input: AdminGalleryItemInput,
): Promise<ActionResult<{ id: string }>> {
  return adminApiAction('saveGalleryItem', () => saveContentEntity(GALLERY_PATH, id, input), {
    revalidatesContent: true,
    fieldErrors: { 'admin.errors.missingMedia': { field: 'mediaId' } },
    onSuccess: async data =>
      actionOk(
        { id: data.id },
        await translateAdminMessage({ key: id === null ? 'admin.gallery.created' : 'admin.gallery.saved' }),
      ),
  });
}

/** Adds several media files to the end of the gallery at once (captions can be filled in later). */
export async function addGalleryItems(input: AdminGalleryBulkInput): Promise<ActionResult<{ count: number }>> {
  return adminApiAction(
    'addGalleryItems',
    () => adminRequest<AdminGalleryBulkAdded>(`${GALLERY_PATH}/bulk`, { method: 'POST', body: input }),
    {
      revalidatesContent: true,
      onSuccess: async data =>
        actionOk(
          { count: data.count },
          await translateAdminMessage({ key: 'admin.gallery.added', values: { count: data.count } }),
        ),
    },
  );
}
