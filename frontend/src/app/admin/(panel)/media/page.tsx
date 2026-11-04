import { getTranslations } from 'next-intl/server';

import { MediaLibrary } from '@/components/admin/media/MediaLibrary';
import { PageHeader } from '@/components/admin/ui/layout';
import { adminPageMetadata } from '@/lib/admin/i18n-server';
import { MAX_IMAGE_DIMENSION } from '@/lib/admin/media-constants';
import { getMediaLibrary } from '@/lib/admin/queries/media';

import type { Metadata } from 'next';
import type { ReactElement } from 'react';

/**
 * Request-time auth check and data fetch prevent this route from claiming instant navigation.
 */
export const instant = false;

export function generateMetadata(): Promise<Metadata> {
  return adminPageMetadata('media.title');
}

export default async function MediaPage(): Promise<ReactElement> {
  const [library, t] = await Promise.all([getMediaLibrary(), getTranslations('admin.media')]);
  return (
    <>
      <PageHeader title={t('title')} description={t('description', { max: MAX_IMAGE_DIMENSION })} />
      <MediaLibrary initial={{ items: library.items, nextCursor: library.nextCursor }} total={library.total} />
    </>
  );
}
