'use server';

import { adminRequest } from '@/lib/api/admin';
import { adminApiAction, type DomainFieldErrors } from '@/lib/api/admin-action';
import { translateAdminMessage } from '@/lib/api/admin-messages';
import type { AdminSiteSettingsSaveRequest } from '@shared/contracts/catalog';

import { actionOk, type ActionResult } from '../action-result';

/** Refusals of the backend shown at their field too (as the old action did). */
const REFUSALS: DomainFieldErrors = {
  // The scale cannot drop below a stored rating: the form then links to /admin/reviews?ratingAbove=<max>.
  'admin.settings.scaleTooLow': { field: 'reviewRatingMax', key: 'admin.settings.scaleTooLowField' },
  'admin.errors.missingMedia': { field: 'ogImageId', key: 'admin.errors.missingMedia' },
};

/**
 * Saves the single site settings row: contacts, the review star scale, SEO, OG image (PUT
 * /admin/settings). Social links are SocialLink rows (./socials.ts).
 */
export async function saveSettings(input: AdminSiteSettingsSaveRequest): Promise<ActionResult> {
  return adminApiAction(
    'saveSettings',
    () => adminRequest<void>('/api/v1/admin/settings', { method: 'PUT', body: input }),
    {
      fieldErrors: REFUSALS,
      revalidatesContent: true,
      onSuccess: async () => actionOk(null, await translateAdminMessage({ key: 'admin.settings.saved' })),
    },
  );
}
