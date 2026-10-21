import { requireAdminRoute } from '@/lib/admin/auth';
import { mediaJson, mediaReadFailure } from '@/lib/admin/media-responses';
import { translateMediaUsages } from '@/lib/admin/media-usages';
import { getMediaDetails } from '@/lib/api/media';

/**
 * GET /admin/api/media/<id> → { media: AdminMedia, usages: MediaUsageView[] }
 * (details panel of the media library: where the file is used, with links).
 */
export async function GET(request: Request, { params }: RouteContext<'/admin/api/media/[id]'>): Promise<Response> {
  const denied = await requireAdminRoute(request);
  if (denied) return denied;
  const result = await getMediaDetails((await params).id);
  if (!result.ok) return mediaReadFailure('getMediaDetails', result.failure);
  return mediaJson({ media: result.data.media, usages: await translateMediaUsages(result.data.usages) });
}
