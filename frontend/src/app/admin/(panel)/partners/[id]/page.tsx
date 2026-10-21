import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { PartnerForm } from '@/components/admin/forms/PartnerForm';
import { PageHeader } from '@/components/admin/ui/layout';
import { adminPageMetadata } from '@/lib/admin/i18n-server';
import { getPartnerForm } from '@/lib/admin/queries/content';

import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export function generateMetadata(): Promise<Metadata> {
  return adminPageMetadata('partners.editTitle');
}

export default async function EditPage({ params }: PageProps<'/admin/partners/[id]'>): Promise<ReactElement> {
  const { id } = await params;
  const [partner, t] = await Promise.all([getPartnerForm(id), getTranslations('admin.partners')]);
  if (!partner) notFound();
  return (
    <>
      <PageHeader title={partner.name} backHref="/admin/partners" backLabel={t('back')} />
      <PartnerForm key={partner.id} initial={partner} />
    </>
  );
}
