'use server';

import { z } from 'zod';

import { revalidateContent } from '@/lib/content/cache';
import { db } from '@/lib/db';

import { adminAction, errorFailure, missingMediaFailure } from '../action-helpers';
import { actionFail, actionOk, type ActionResult } from '../action-result';
import { errorKey } from '../i18n';
import { getAdminTranslations } from '../i18n-server';
import { galleryInputSchema, idSchema, type GalleryInput } from '../schemas';
import { parseInput } from '../validation';

/** Create (id = null) or update a gallery item. */
export async function saveGalleryItem(id: string | null, input: GalleryInput): Promise<ActionResult<{ id: string }>> {
  return adminAction('saveGalleryItem', async () => {
    const parsedId = id === null ? null : idSchema.safeParse(id);
    if (parsedId && !parsedId.success) return errorFailure('invalidId');
    const parsed = await parseInput(galleryInputSchema, input);
    if (!parsed.success) return actionFail(parsed.message, parsed.fieldErrors);
    const data = parsed.data;
    const currentId = parsedId?.data ?? null;

    const missingMedia = await missingMediaFailure([data.mediaId], ['mediaId']);
    if (missingMedia) return missingMedia;
    const fields = { mediaId: data.mediaId, caption: data.caption, published: data.published };

    let savedId: string;
    if (currentId) {
      savedId = (await db.galleryItem.update({ where: { id: currentId }, data: fields, select: { id: true } })).id;
    } else {
      const last = await db.galleryItem.aggregate({ _max: { order: true } });
      savedId = (
        await db.galleryItem.create({ data: { ...fields, order: (last._max.order ?? -1) + 1 }, select: { id: true } })
      ).id;
    }
    revalidateContent();
    const t = await getAdminTranslations('admin.gallery');
    return actionOk({ id: savedId }, t(currentId ? 'saved' : 'created'));
  });
}

const bulkGallerySchema = z.object({
  mediaIds: z
    .array(idSchema)
    .min(1, errorKey('photosRequired'))
    .max(100, errorKey('photosBulkTooMany'))
    .refine(ids => new Set(ids).size === ids.length, errorKey('photosDuplicate')),
  published: z.boolean(),
});

/** Adds several media files to the end of the gallery at once (captions can be filled in later). */
export async function addGalleryItems(input: {
  mediaIds: string[];
  published: boolean;
}): Promise<ActionResult<{ count: number }>> {
  return adminAction('addGalleryItems', async () => {
    const parsed = await parseInput(bulkGallerySchema, input);
    if (!parsed.success) return actionFail(parsed.message, parsed.fieldErrors);
    const { mediaIds, published } = parsed.data;
    const missingMedia = await missingMediaFailure(mediaIds);
    if (missingMedia) return missingMedia;

    const last = await db.galleryItem.aggregate({ _max: { order: true } });
    const start = (last._max.order ?? -1) + 1;
    await db.galleryItem.createMany({
      data: mediaIds.map((mediaId, index) => ({ mediaId, order: start + index, published, caption: {} })),
    });
    revalidateContent();
    const t = await getAdminTranslations('admin.gallery');
    return actionOk({ count: mediaIds.length }, t('added', { count: mediaIds.length }));
  });
}
