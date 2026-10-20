import { getTranslations } from 'next-intl/server';

import { OfferForm } from '@/components/admin/forms/OfferForm';
import { PageHeader } from '@/components/admin/ui/layout';
import { requireAdminPage } from '@/lib/admin/auth';
import { adminPageMetadata } from '@/lib/admin/i18n-server';

import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export function generateMetadata(): Promise<Metadata> {
  return adminPageMetadata('offers.newTitle');
}

export default async function NewPage(): Promise<ReactElement> {
  await requireAdminPage();
  const t = await getTranslations('admin.offers');
  return (
    <>
      <PageHeader title={t('newTitle')} backHref="/admin/offers" backLabel={t('back')} />
      <OfferForm initial={null} />
    </>
  );
}
