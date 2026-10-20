import { getTranslations } from 'next-intl/server';

import { SettingsForm } from '@/components/admin/forms/SettingsForm';
import { PageHeader } from '@/components/admin/ui/layout';
import { adminPageMetadata } from '@/lib/admin/i18n-server';
import { getSettingsForm } from '@/lib/admin/queries';

import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export function generateMetadata(): Promise<Metadata> {
  return adminPageMetadata('settings.title');
}

export default async function SettingsPage(): Promise<ReactElement> {
  const [settings, t] = await Promise.all([getSettingsForm(), getTranslations('admin.settings')]);
  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <SettingsForm initial={settings} />
    </>
  );
}
