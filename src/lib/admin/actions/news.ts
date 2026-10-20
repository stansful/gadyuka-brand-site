'use server';

import { revalidateContent } from '@/lib/content/cache';
import { db } from '@/lib/db';

import { adminAction, errorFailure, missingMediaFailure } from '../action-helpers';
import { actionFail, actionOk, type ActionResult } from '../action-result';
import { getAdminTranslations } from '../i18n-server';
import { idSchema, newsDateFromInput, newsInputSchema, type NewsInput } from '../schemas';
import { parseInput } from '../validation';

/** Create (id = null) or update a news item. News are ordered by date (newest first). */
export async function saveNews(id: string | null, input: NewsInput): Promise<ActionResult<{ id: string }>> {
  return adminAction('saveNews', async () => {
    const parsedId = id === null ? null : idSchema.safeParse(id);
    if (parsedId && !parsedId.success) return errorFailure('invalidId');
    const parsed = await parseInput(newsInputSchema, input);
    if (!parsed.success) return actionFail(parsed.message, parsed.fieldErrors);
    const data = parsed.data;
    const currentId = parsedId?.data ?? null;

    const slugTaken = await db.newsItem.findFirst({
      where: { slug: data.slug, ...(currentId ? { NOT: { id: currentId } } : {}) },
      select: { id: true },
    });
    const t = await getAdminTranslations('admin.news');
    if (slugTaken)
      return actionFail((await getAdminTranslations('admin.errors'))('slugTaken'), { slug: t('slugTaken') });
    const missingMedia = await missingMediaFailure([data.imageId], ['imageId']);
    if (missingMedia) return missingMedia;

    const fields = {
      slug: data.slug,
      title: data.title,
      excerpt: data.excerpt,
      body: data.body,
      date: newsDateFromInput(data.date),
      imageId: data.imageId,
      published: data.published,
    };

    const savedId = currentId
      ? (await db.newsItem.update({ where: { id: currentId }, data: fields, select: { id: true } })).id
      : (await db.newsItem.create({ data: fields, select: { id: true } })).id;

    revalidateContent();
    return actionOk({ id: savedId }, t(currentId ? 'saved' : 'created'));
  });
}
