import { requireAdminRoute } from '@/lib/admin/auth';
import { getAdminTranslations } from '@/lib/admin/i18n-server';
import { getAdminMedia, getMediaUsages } from '@/lib/admin/media-service';
import { idSchema } from '@/lib/admin/schemas';

/**
 * GET /admin/api/media/<id> → { media: AdminMedia, usages: MediaUsage[] }
 * (details panel of the media library: where the file is used).
 */
export async function GET(request: Request, { params }: RouteContext<'/admin/api/media/[id]'>): Promise<Response> {
  const denied = await requireAdminRoute(request);
  if (denied) return denied;

  const id = idSchema.safeParse((await params).id);
  if (!id.success) {
    const t = await getAdminTranslations('admin.errors');
    return Response.json({ error: t('invalidId') }, { status: 400 });
  }

  const [media, usages] = await Promise.all([getAdminMedia(id.data), getMediaUsages(id.data)]);
  if (!media) {
    const t = await getAdminTranslations('admin.media.errors');
    return Response.json({ error: t('notFound') }, { status: 404 });
  }
  return Response.json({ media, usages }, { headers: { 'Cache-Control': 'no-store' } });
}
