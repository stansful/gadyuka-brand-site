'use server';

import { revalidateContent } from '@/lib/content/cache';
import { db } from '@/lib/db';

import { adminAction, errorFailure, missingMediaFailure } from '../action-helpers';
import { actionFail, actionOk, type ActionResult } from '../action-result';
import { getAdminTranslations } from '../i18n-server';
import { collectionInputSchema, idSchema, type CollectionInput } from '../schemas';
import { parseInput } from '../validation';

/** Create (id = null) or update a collection. */
export async function saveCollection(id: string | null, input: CollectionInput): Promise<ActionResult<{ id: string }>> {
  return adminAction('saveCollection', async () => {
    const parsedId = id === null ? null : idSchema.safeParse(id);
    if (parsedId && !parsedId.success) return errorFailure('invalidId');
    const parsed = await parseInput(collectionInputSchema, input);
    if (!parsed.success) return actionFail(parsed.message, parsed.fieldErrors);
    const data = parsed.data;
    const currentId = parsedId?.data ?? null;

    const slugTaken = await db.collection.findFirst({
      where: { slug: data.slug, ...(currentId ? { NOT: { id: currentId } } : {}) },
      select: { id: true },
    });
    const t = await getAdminTranslations('admin.collections');
    if (slugTaken)
      return actionFail((await getAdminTranslations('admin.errors'))('slugTaken'), { slug: t('slugTaken') });
    const missingMedia = await missingMediaFailure([data.coverId], ['coverId']);
    if (missingMedia) return missingMedia;

    const fields = {
      slug: data.slug,
      title: data.title,
      description: data.description,
      coverId: data.coverId,
      published: data.published,
    };

    let savedId: string;
    if (currentId) {
      const row = await db.collection.update({ where: { id: currentId }, data: fields, select: { id: true } });
      savedId = row.id;
    } else {
      const last = await db.collection.aggregate({ _max: { order: true } });
      const row = await db.collection.create({
        data: { ...fields, order: (last._max.order ?? -1) + 1 },
        select: { id: true },
      });
      savedId = row.id;
    }
    revalidateContent();
    return actionOk({ id: savedId }, t(currentId ? 'saved' : 'created'));
  });
}
