'use server';

import { revalidateContent } from '@/lib/content/cache';
import { db } from '@/lib/db';

import { adminAction, errorFailure, missingMediaFailure } from '../action-helpers';
import { actionFail, actionOk, type ActionResult } from '../action-result';
import { getAdminTranslations } from '../i18n-server';
import { endOfDayFromInput, idSchema, offerInputSchema, type OfferInput } from '../schemas';
import { parseInput } from '../validation';

/** Create (id = null) or update a special offer. */
export async function saveOffer(id: string | null, input: OfferInput): Promise<ActionResult<{ id: string }>> {
  return adminAction('saveOffer', async () => {
    const parsedId = id === null ? null : idSchema.safeParse(id);
    if (parsedId && !parsedId.success) return errorFailure('invalidId');
    const parsed = await parseInput(offerInputSchema, input);
    if (!parsed.success) return actionFail(parsed.message, parsed.fieldErrors);
    const data = parsed.data;
    const currentId = parsedId?.data ?? null;

    const missingMedia = await missingMediaFailure([data.imageId], ['imageId']);
    if (missingMedia) return missingMedia;
    const t = await getAdminTranslations('admin.offers');
    const hasLabel = Object.keys(data.ctaLabel).length > 0;
    if (hasLabel && !data.ctaHref) {
      return actionFail(t('ctaHrefRequired'), { ctaHref: t('ctaHrefRequiredField') });
    }

    const fields = {
      title: data.title,
      text: data.text,
      badge: data.badge,
      ctaLabel: data.ctaLabel,
      ctaHref: data.ctaHref && data.ctaHref.length > 0 ? data.ctaHref : null,
      validUntil: data.validUntil ? endOfDayFromInput(data.validUntil) : null,
      imageId: data.imageId,
      published: data.published,
    };

    let savedId: string;
    if (currentId) {
      savedId = (await db.offer.update({ where: { id: currentId }, data: fields, select: { id: true } })).id;
    } else {
      const last = await db.offer.aggregate({ _max: { order: true } });
      savedId = (
        await db.offer.create({ data: { ...fields, order: (last._max.order ?? -1) + 1 }, select: { id: true } })
      ).id;
    }
    revalidateContent();
    return actionOk({ id: savedId }, t(currentId ? 'saved' : 'created'));
  });
}
