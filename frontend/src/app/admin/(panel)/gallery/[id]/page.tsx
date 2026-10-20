import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { GalleryForm } from '@/components/admin/forms/GalleryForm';
import { PageHeader } from '@/components/admin/ui/layout';
import { adminPageMetadata } from '@/lib/admin/i18n-server';
import { getGalleryForm } from '@/lib/admin/queries';

import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export function generateMetadata(): Promise<Metadata> {
  return adminPageMetadata('gallery.editTitle');
}

export default async function EditPage({ params }: PageProps<'/admin/gallery/[id]'>): Promise<ReactElement> {
  const { id } = await params;
  const [item, t] = await Promise.all([getGalleryForm(id), getTranslations('admin.gallery')]);
  if (!item) notFound();
  return (
    <>
      <PageHeader title={item.caption.ru || t('editTitle')} backHref="/admin/gallery" backLabel={t('back')} />
      <GalleryForm key={item.id} initial={item} />
    </>
  );
}
