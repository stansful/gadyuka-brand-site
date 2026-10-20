import { getTranslations } from 'next-intl/server';

import { PartnerForm } from '@/components/admin/forms/PartnerForm';
import { PageHeader } from '@/components/admin/ui/layout';
import { requireAdminPage } from '@/lib/admin/auth';
import { adminPageMetadata } from '@/lib/admin/i18n-server';

import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export function generateMetadata(): Promise<Metadata> {
  return adminPageMetadata('partners.newTitle');
}

export default async function NewPage(): Promise<ReactElement> {
  await requireAdminPage();
  const t = await getTranslations('admin.partners');
  return (
    <>
      <PageHeader title={t('newTitle')} backHref="/admin/partners" backLabel={t('back')} />
      <PartnerForm initial={null} />
    </>
  );
}
