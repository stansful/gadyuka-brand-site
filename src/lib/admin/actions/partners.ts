'use server';

import { revalidateContent } from '@/lib/content/cache';
import { db } from '@/lib/db';

import { adminAction, errorFailure, missingMediaFailure } from '../action-helpers';
import { actionFail, actionOk, type ActionResult } from '../action-result';
import { getAdminTranslations } from '../i18n-server';
import { idSchema, partnerInputSchema, type PartnerInput } from '../schemas';
import { parseInput } from '../validation';

/** Create (id = null) or update a partner. */
export async function savePartner(id: string | null, input: PartnerInput): Promise<ActionResult<{ id: string }>> {
  return adminAction('savePartner', async () => {
    const parsedId = id === null ? null : idSchema.safeParse(id);
    if (parsedId && !parsedId.success) return errorFailure('invalidId');
    const parsed = await parseInput(partnerInputSchema, input);
    if (!parsed.success) return actionFail(parsed.message, parsed.fieldErrors);
    const data = parsed.data;
    const currentId = parsedId?.data ?? null;

    const missingMedia = await missingMediaFailure([data.logoId], ['logoId']);
    if (missingMedia) return missingMedia;
    const fields = {
      name: data.name,
      url: data.url,
      logoId: data.logoId,
      description: data.description,
      published: data.published,
    };

    let savedId: string;
    if (currentId) {
      savedId = (await db.partner.update({ where: { id: currentId }, data: fields, select: { id: true } })).id;
    } else {
      const last = await db.partner.aggregate({ _max: { order: true } });
      savedId = (
        await db.partner.create({ data: { ...fields, order: (last._max.order ?? -1) + 1 }, select: { id: true } })
      ).id;
    }
    revalidateContent();
    const t = await getAdminTranslations('admin.partners');
    return actionOk({ id: savedId }, t(currentId ? 'saved' : 'created'));
  });
}
