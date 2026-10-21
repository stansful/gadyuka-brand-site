import 'server-only';
import type { MediaPage } from '@/components/admin/media/media-types';
import { ApiRequestError } from '@/lib/api/api-result';
import { listMediaPage } from '@/lib/api/media';

import { requireAdminPage } from '../auth';

/**
 * Media library. Data from the backend (GET /api/v1/admin/media); authorizes first
 * (requireAdminPage → redirect to /admin/login), so the page never reads admin data without a
 * session. A backend failure throws (the admin error page shows).
 */
export async function getMediaLibrary(query?: string): Promise<MediaPage & { total: number }> {
  await requireAdminPage();
  const result = await listMediaPage({ q: query });
  if (!result.ok) throw new ApiRequestError('/api/v1/admin/media', result.failure);
  return { items: [...result.data.items], nextCursor: result.data.nextCursor, total: result.data.total };
}
