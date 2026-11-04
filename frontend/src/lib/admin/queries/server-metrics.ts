import 'server-only';
import { readAdminData } from '@/lib/api/admin-read';
import type { ServerMetricsResponse } from '@shared/contracts/server-metrics';

import { requireAdminPage } from '../auth';

const SERVER_METRICS_PATH = '/api/v1/admin/server-metrics';

export async function getServerMetrics(): Promise<ServerMetricsResponse> {
  await requireAdminPage();
  return readAdminData<ServerMetricsResponse>(SERVER_METRICS_PATH);
}
