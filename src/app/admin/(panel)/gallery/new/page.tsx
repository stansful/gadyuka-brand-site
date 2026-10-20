import { getTranslations } from 'next-intl/server';

import { GalleryForm } from '@/components/admin/forms/GalleryForm';
import { PageHeader } from '@/components/admin/ui/layout';
import { requireAdminPage } from '@/lib/admin/auth';
import { adminPageMetadata } from '@/lib/admin/i18n-server';

import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export function generateMetadata(): Promise<Metadata> {
  return adminPageMetadata('gallery.newTitle');
}

export default async function NewPage(): Promise<ReactElement> {
  await requireAdminPage();
  const t = await getTranslations('admin.gallery');
  return (
    <>
      <PageHeader title={t('newTitle')} backHref="/admin/gallery" backLabel={t('back')} />
      <GalleryForm initial={null} />
    </>
  );
}
