import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { OfferForm } from '@/components/admin/forms/OfferForm';
import { PageHeader } from '@/components/admin/ui/layout';
import { adminPageMetadata } from '@/lib/admin/i18n-server';
import { getOfferForm } from '@/lib/admin/queries';

import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export function generateMetadata(): Promise<Metadata> {
  return adminPageMetadata('offers.editTitle');
}

export default async function EditPage({ params }: PageProps<'/admin/offers/[id]'>): Promise<ReactElement> {
  const { id } = await params;
  const [offer, t] = await Promise.all([getOfferForm(id), getTranslations('admin.offers')]);
  if (!offer) notFound();
  return (
    <>
      <PageHeader title={offer.title.ru || t('editTitle')} backHref="/admin/offers" backLabel={t('back')} />
      <OfferForm key={offer.id} initial={offer} />
    </>
  );
}
