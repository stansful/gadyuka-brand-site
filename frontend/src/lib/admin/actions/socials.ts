'use server';

import { adminApiAction } from '@/lib/api/admin-action';
import { translateAdminMessage } from '@/lib/api/admin-messages';
import { saveContentEntity } from '@/lib/api/content-entities';
import type { AdminSocialLinkInput } from '@shared/contracts/content-entities';

import { actionOk, type ActionResult } from '../action-result';

/**
 * Create (id = null) or update a social link (contacts section + JSON-LD sameAs). An empty
 * label is stored as {} — the site then shows the default name of the type (`social.<TYPE>`).
 */
export async function saveSocialLink(
  id: string | null,
  input: AdminSocialLinkInput,
): Promise<ActionResult<{ id: string }>> {
  return adminApiAction('saveSocialLink', () => saveContentEntity('/api/v1/admin/social-links', id, input), {
    revalidatesContent: true,
    onSuccess: async data =>
      actionOk(
        { id: data.id },
        await translateAdminMessage({ key: id === null ? 'admin.socials.created' : 'admin.socials.saved' }),
      ),
  });
}
