'use server';

import { revalidateContent } from '@/lib/content/cache';
import { db } from '@/lib/db';
import type { LocalizedText } from '@/lib/i18n-text';
import { removeStoredImage } from '@/lib/media';

import type { DeleteMediaResult, MediaUsage } from '../types';

import { adminAction, errorFailure } from '../action-helpers';
import { actionFail, actionOk, type ActionResult } from '../action-result';
import { getAdminTranslations } from '../i18n-server';
import { getMediaUsages } from '../media-service';
import { idSchema, mediaAltInputSchema } from '../schemas';
import { parseInput } from '../validation';

export async function updateMediaAlt(id: string, alt: LocalizedText): Promise<ActionResult<{ alt: LocalizedText }>> {
  return adminAction('updateMediaAlt', async () => {
    const parsed = await parseInput(mediaAltInputSchema, { id, alt });
    if (!parsed.success) return actionFail(parsed.message, parsed.fieldErrors);
    await db.media.update({ where: { id: parsed.data.id }, data: { alt: parsed.data.alt }, select: { id: true } });
    revalidateContent();
    const t = await getAdminTranslations('admin.media');
    return actionOk({ alt: parsed.data.alt }, t('altSaved'));
  });
}

/**
 * Deletes a media file (row + S3 object) — only when nothing references it. Otherwise returns
 * the list of places that use it (the UI shows them as links).
 */
export async function deleteMedia(id: string): Promise<DeleteMediaResult> {
  const blocked: { usages: MediaUsage[] | null } = { usages: null };
  const result = await adminAction('deleteMedia', async () => {
    const rowId = idSchema.safeParse(id);
    if (!rowId.success) return errorFailure('invalidId');
    const t = await getAdminTranslations('admin.media');
    const media = await db.media.findUnique({
      where: { id: rowId.data },
      select: { id: true, bucket: true, key: true },
    });
    if (!media) return actionFail(t('errors.notFoundDeleted'));

    const usages = await getMediaUsages(media.id);
    if (usages.length > 0) {
      blocked.usages = usages;
      return actionFail(t('errors.inUse'));
    }

    // Restrict FKs (gallery, product images) make the DB refuse if a reference appeared meanwhile.
    await db.media.delete({ where: { id: media.id }, select: { id: true } });
    // The row is gone first: a failed object delete leaves an unreferenced object in the bucket
    // (logged), never a row pointing at a missing file.
    try {
      await removeStoredImage(media);
    } catch (error: unknown) {
      console.error(
        `[admin] media ${media.id} deleted from DB but S3 object ${media.bucket}/${media.key} was not:`,
        error,
      );
    }
    revalidateContent();
    return actionOk(null, t('details.deleted'));
  });
  if (!result.ok && blocked.usages) return { ok: false, error: result.error, usages: blocked.usages };
  return result;
}
