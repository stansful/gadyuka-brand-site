import { getTranslations } from 'next-intl/server';

import { CollectionForm } from '@/components/admin/forms/CollectionForm';
import { PageHeader } from '@/components/admin/ui/layout';
import { requireAdminPage } from '@/lib/admin/auth';
import { adminPageMetadata } from '@/lib/admin/i18n-server';

import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export function generateMetadata(): Promise<Metadata> {
  return adminPageMetadata('collections.newTitle');
}

export default async function NewCollectionPage(): Promise<ReactElement> {
  await requireAdminPage();
  const t = await getTranslations('admin.collections');
  return (
    <>
      <PageHeader title={t('newTitle')} backHref="/admin/collections" backLabel={t('back')} />
      <CollectionForm initial={null} />
    </>
  );
}
