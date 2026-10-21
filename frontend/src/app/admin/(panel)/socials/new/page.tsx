import { getTranslations } from 'next-intl/server';

import { SocialLinkForm } from '@/components/admin/forms/SocialLinkForm';
import { PageHeader } from '@/components/admin/ui/layout';
import { adminPageMetadata } from '@/lib/admin/i18n-server';
import { getSocialDefaultLabels } from '@/lib/admin/queries/content';

import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export function generateMetadata(): Promise<Metadata> {
  return adminPageMetadata('socials.newTitle');
}

export default async function NewPage(): Promise<ReactElement> {
  const [defaultLabels, t] = await Promise.all([getSocialDefaultLabels(), getTranslations('admin.socials')]);
  return (
    <>
      <PageHeader title={t('newTitle')} backHref="/admin/socials" backLabel={t('back')} />
      <SocialLinkForm initial={null} defaultLabels={defaultLabels} />
    </>
  );
}
