import { requireAdminRoute } from '@/lib/admin/auth';
import { readAdminData } from '@/lib/api/admin-read';
import type { ServerMetricsResponse } from '@shared/contracts/server-metrics';

export async function GET(request: Request): Promise<Response> {
  const denied = await requireAdminRoute(request);
  if (denied) return denied;

  const metrics = await readAdminData<ServerMetricsResponse>('/api/v1/admin/server-metrics');
  return Response.json(metrics);
}
