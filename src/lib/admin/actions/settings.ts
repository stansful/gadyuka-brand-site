'use server';

import { revalidateContent } from '@/lib/content/cache';
import { db } from '@/lib/db';

import { adminAction, missingMediaFailure } from '../action-helpers';
import { actionFail, actionOk, type ActionResult } from '../action-result';
import { getAdminTranslations } from '../i18n-server';
import { settingsInputSchema, type SettingsInput } from '../schemas';
import { parseInput } from '../validation';

/**
 * Saves the single SiteSettings row (id = 1): contacts, the review star scale, SEO, OG image.
 * Social links are SocialLink rows (./socials.ts).
 *
 * The star scale cannot be lowered below a stored rating: the action counts the reviews rated
 * higher than the new maximum and refuses with that number (the form links to exactly those
 * reviews: /admin/reviews?ratingAbove=<max>).
 */
export async function saveSettings(input: SettingsInput): Promise<ActionResult> {
  return adminAction('saveSettings', async () => {
    const parsed = await parseInput(settingsInputSchema, input);
    if (!parsed.success) return actionFail(parsed.message, parsed.fieldErrors);
    const data = parsed.data;
    const missingMedia = await missingMediaFailure([data.ogImageId], ['ogImageId']);
    if (missingMedia) return missingMedia;

    const t = await getAdminTranslations('admin.settings');
    const aboveScale = await db.review.count({ where: { rating: { gt: data.reviewRatingMax } } });
    if (aboveScale > 0) {
      const values = { count: aboveScale, max: data.reviewRatingMax };
      return actionFail(t('scaleTooLow', values), { reviewRatingMax: t('scaleTooLowField', values) });
    }

    const fields = {
      phone: data.phone,
      email: data.email,
      address: data.address,
      reviewRatingMax: data.reviewRatingMax,
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      ogImageId: data.ogImageId,
    };
    await db.siteSettings.upsert({
      where: { id: 1 },
      create: { id: 1, ...fields },
      update: fields,
      select: { id: true },
    });
    revalidateContent();
    return actionOk(null, t('saved'));
  });
}
