'use server';

import { revalidateContent } from '@/lib/content/cache';
import { db } from '@/lib/db';

import { adminAction, errorFailure, missingMediaFailure } from '../action-helpers';
import { actionFail, actionOk, type ActionResult } from '../action-result';
import { getAdminTranslations } from '../i18n-server';
import { DEFAULT_REVIEW_RATING_MAX, idSchema, reviewInputSchema, type ReviewInput } from '../schemas';
import { parseInput } from '../validation';

/**
 * Create (id = null) or update a review. The rating must fit the CURRENT star scale
 * (SiteSettings.reviewRatingMax, read here — the form's own copy of it may be stale).
 */
export async function saveReview(id: string | null, input: ReviewInput): Promise<ActionResult<{ id: string }>> {
  return adminAction('saveReview', async () => {
    const parsedId = id === null ? null : idSchema.safeParse(id);
    if (parsedId && !parsedId.success) return errorFailure('invalidId');
    const parsed = await parseInput(reviewInputSchema, input);
    if (!parsed.success) return actionFail(parsed.message, parsed.fieldErrors);
    const data = parsed.data;
    const currentId = parsedId?.data ?? null;
    const t = await getAdminTranslations('admin.reviews');

    if (data.rating !== null) {
      const settings = await db.siteSettings.findUnique({ where: { id: 1 }, select: { reviewRatingMax: true } });
      const max = settings?.reviewRatingMax ?? DEFAULT_REVIEW_RATING_MAX;
      if (data.rating > max) {
        return actionFail(t('ratingAboveScale', { rating: data.rating }), {
          rating: t('ratingAboveScaleField', { max }),
        });
      }
    }
    const missingMedia = await missingMediaFailure([data.avatarId], ['avatarId']);
    if (missingMedia) return missingMedia;

    const fields = {
      author: data.author,
      role: data.role,
      text: data.text,
      avatarId: data.avatarId,
      rating: data.rating,
      published: data.published,
    };

    let savedId: string;
    if (currentId) {
      savedId = (await db.review.update({ where: { id: currentId }, data: fields, select: { id: true } })).id;
    } else {
      const last = await db.review.aggregate({ _max: { order: true } });
      savedId = (
        await db.review.create({ data: { ...fields, order: (last._max.order ?? -1) + 1 }, select: { id: true } })
      ).id;
    }
    revalidateContent();
    return actionOk({ id: savedId }, t(currentId ? 'saved' : 'created'));
  });
}
