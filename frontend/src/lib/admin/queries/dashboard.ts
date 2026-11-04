import 'server-only';
import { readAdminData } from '@/lib/api/admin-read';
import type { DashboardLeadItem, DashboardNewLeadsResponse, DashboardResponse } from '@shared/contracts/dashboard';

import { requireAdminPage } from '../auth';
import { getAdminTranslations } from '../i18n-server';

/**
 * Admin dashboard + the new-leads badge of the sidebar, from the backend (GET /api/v1/admin/dashboard,
 * GET /api/v1/admin/dashboard/new-leads). Every function
 * authorizes first (requireAdminPage → redirect to /admin/login); a backend failure throws
 * ApiRequestError (the admin error page).
 */

export type DashboardData = {
  counts: Array<{ label: string; href: string; total: number; published?: number; note?: string }>;
  leads: { total: number; fresh: number; telegramFailed: number };
  visits: { today: number; yesterday: number };
  latestLeads: readonly DashboardLeadItem[];
};

const DASHBOARD_PATH = '/api/v1/admin/dashboard';
const NEW_LEADS_PATH = '/api/v1/admin/dashboard/new-leads';

export async function getDashboardData(): Promise<DashboardData> {
  await requireAdminPage();
  const [dashboard, nav, t] = await Promise.all([
    readAdminData<DashboardResponse>(DASHBOARD_PATH),
    getAdminTranslations('admin.nav.items'),
    getAdminTranslations('admin.dashboard'),
  ]);
  const { entities, media, texts, leads, latestLeads } = dashboard;
  const list = (kind: keyof DashboardResponse['entities']) => entities[kind];

  return {
    counts: [
      {
        label: nav('content'),
        href: '/admin/content',
        total: texts.total,
        note: [
          t('textsEdited', { count: texts.edited }),
          texts.gaps > 0 ? t('textsGaps', { count: texts.gaps }) : '',
          texts.unsaved > 0 ? t('textsUnsaved', { count: texts.unsaved }) : '',
        ]
          .filter(Boolean)
          .join(' · '),
      },
      { label: nav('menu'), href: '/admin/menu', ...list('menuItem') },
      { label: nav('socials'), href: '/admin/socials', ...list('socialLink') },
      { label: nav('collections'), href: '/admin/collections', ...list('collection') },
      { label: nav('products'), href: '/admin/products', ...list('product') },
      { label: nav('reviews'), href: '/admin/reviews', ...list('review') },
      { label: nav('news'), href: '/admin/news', ...list('news') },
      { label: nav('gallery'), href: '/admin/gallery', ...list('gallery') },
      { label: nav('offers'), href: '/admin/offers', ...list('offer') },
      { label: nav('partners'), href: '/admin/partners', ...list('partner') },
      { label: nav('media'), href: '/admin/media', total: media },
    ],
    leads: { ...leads },
    visits: dashboard.visits,
    latestLeads,
  };
}

/** Badge in the sidebar. */
export async function getNewLeadCount(): Promise<number> {
  await requireAdminPage();
  return (await readAdminData<DashboardNewLeadsResponse>(NEW_LEADS_PATH)).count;
}
