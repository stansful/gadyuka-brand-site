import 'server-only';
import { readAdminData } from '@/lib/api/admin-read';
import type { SiteTextsPageResponse } from '@shared/contracts/site-texts';

import { requireAdminPage } from '../auth';
import { getAdminTranslations } from '../i18n-server';
import { siteTextLabels, toSiteTextsPageData, type SiteTextsPageData } from '../site-texts';

/**
 * «Тексты сайта»: the page data from the backend (GET /api/v1/admin/site-texts).
 * Authorizes first (requireAdminPage → redirect to /admin/login); a backend failure throws
 * ApiRequestError (the admin error page).
 */

const SITE_TEXTS_PATH = '/api/v1/admin/site-texts';

/**
 * The section tabs with their counters, plus either one section (its texts in shared/messages/ru.json
 * order and its landing images) or — with a non-blank `query` — the texts of every section that match
 * it (key, label, current or default value). An unknown `section` falls back to «Главная (обложка)».
 */
export async function getSiteTextsPage(params: { section: string | null; query: string }): Promise<SiteTextsPageData> {
  await requireAdminPage();
  const [page, t] = await Promise.all([
    readAdminData<SiteTextsPageResponse>(SITE_TEXTS_PATH, { query: { section: params.section, q: params.query } }),
    getAdminTranslations('admin.siteTexts'),
  ]);
  return toSiteTextsPageData(page, siteTextLabels(t));
}
