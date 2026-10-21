'use server';

import { adminApiAction } from '@/lib/api/admin-action';
import { translateAdminMessage } from '@/lib/api/admin-messages';
import { saveContentEntity } from '@/lib/api/content-entities';
import type { AdminNewsInput } from '@shared/contracts/content-entities';

import { actionOk, type ActionResult } from '../action-result';

/**
 * Create (id = null) or update a news item (POST /admin/news, PUT /admin/news/:id). News are ordered
 * by date (newest first); the backend validates, stores the day as noon Moscow time and refuses a
 * slug another news item has (shown on the slug field) or a picture that no longer exists.
 */
export async function saveNews(id: string | null, input: AdminNewsInput): Promise<ActionResult<{ id: string }>> {
  return adminApiAction('saveNews', () => saveContentEntity('/api/v1/admin/news', id, input), {
    revalidatesContent: true,
    fieldErrors: {
      'admin.errors.slugTaken': { field: 'slug', key: 'admin.news.slugTaken' },
      'admin.errors.missingMedia': { field: 'imageId' },
    },
    onSuccess: async data =>
      actionOk(
        { id: data.id },
        await translateAdminMessage({ key: id === null ? 'admin.news.created' : 'admin.news.saved' }),
      ),
  });
}
