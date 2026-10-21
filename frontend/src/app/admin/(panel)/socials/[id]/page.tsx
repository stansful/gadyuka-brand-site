import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { SocialLinkForm } from '@/components/admin/forms/SocialLinkForm';
import { PageHeader } from '@/components/admin/ui/layout';
import { adminPageMetadata } from '@/lib/admin/i18n-server';
import { getSocialDefaultLabels, getSocialLinkForm } from '@/lib/admin/queries/content';

import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export function generateMetadata(): Promise<Metadata> {
  return adminPageMetadata('socials.editTitle');
}

export default async function EditPage({ params }: PageProps<'/admin/socials/[id]'>): Promise<ReactElement> {
  const { id } = await params;
  const [link, defaultLabels, t] = await Promise.all([
    getSocialLinkForm(id),
    getSocialDefaultLabels(),
    getTranslations('admin.socials'),
  ]);
  if (!link) notFound();
  return (
    <>
      <PageHeader title={link.label.ru || t(`types.${link.type}`)} backHref="/admin/socials" backLabel={t('back')} />
      <SocialLinkForm key={link.id} initial={link} defaultLabels={defaultLabels} />
    </>
  );
}
