import 'server-only';
import { readAdminData } from '@/lib/api/admin-read';
import type { VisitsRecentResponse, VisitsStatsQuery, VisitsStatsResponse } from '@shared/contracts/visits';

import { requireAdminPage } from '../auth';

const STATS_PATH = '/api/v1/admin/visits/stats';
const RECENT_PATH = '/api/v1/admin/visits/recent';

export async function getVisitsStats(query: VisitsStatsQuery): Promise<VisitsStatsResponse> {
  await requireAdminPage();
  return readAdminData<VisitsStatsResponse>(STATS_PATH, {
    query: { from: query.from, to: query.to, granularity: query.granularity },
  });
}

export async function getVisitsRecent(limit = 20): Promise<VisitsRecentResponse> {
  await requireAdminPage();
  return readAdminData<VisitsRecentResponse>(RECENT_PATH, { query: { limit } });
}
