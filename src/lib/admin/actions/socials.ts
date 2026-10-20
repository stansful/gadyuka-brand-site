'use server';

import { revalidateContent } from '@/lib/content/cache';
import { db } from '@/lib/db';

import { adminAction, errorFailure } from '../action-helpers';
import { actionFail, actionOk, type ActionResult } from '../action-result';
import { getAdminTranslations } from '../i18n-server';
import { idSchema, socialLinkInputSchema, type SocialLinkInput } from '../schemas';
import { parseInput } from '../validation';

/**
 * Create (id = null) or update a social link (contacts section + JSON-LD sameAs). An empty
 * label is stored as {} — the site then shows the default name of the type (`social.<TYPE>`).
 */
export async function saveSocialLink(id: string | null, input: SocialLinkInput): Promise<ActionResult<{ id: string }>> {
  return adminAction('saveSocialLink', async () => {
    const parsedId = id === null ? null : idSchema.safeParse(id);
    if (parsedId && !parsedId.success) return errorFailure('invalidId');
    const parsed = await parseInput(socialLinkInputSchema, input);
    if (!parsed.success) return actionFail(parsed.message, parsed.fieldErrors);
    const data = parsed.data;
    const currentId = parsedId?.data ?? null;

    const fields = { type: data.type, url: data.url, label: data.label, published: data.published };

    let savedId: string;
    if (currentId) {
      savedId = (await db.socialLink.update({ where: { id: currentId }, data: fields, select: { id: true } })).id;
    } else {
      const last = await db.socialLink.aggregate({ _max: { order: true } });
      savedId = (
        await db.socialLink.create({ data: { ...fields, order: (last._max.order ?? -1) + 1 }, select: { id: true } })
      ).id;
    }
    revalidateContent();
    const t = await getAdminTranslations('admin.socials');
    return actionOk({ id: savedId }, t(currentId ? 'saved' : 'created'));
  });
}
