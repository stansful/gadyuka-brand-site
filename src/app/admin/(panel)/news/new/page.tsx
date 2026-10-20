import { getTranslations } from 'next-intl/server';
import { connection } from 'next/server';

import { NewsForm } from '@/components/admin/forms/NewsForm';
import { PageHeader } from '@/components/admin/ui/layout';
import { requireAdminPage } from '@/lib/admin/auth';
import { adminPageMetadata } from '@/lib/admin/i18n-server';
import { toDateInputValue } from '@/lib/admin/schemas';

import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export function generateMetadata(): Promise<Metadata> {
  return adminPageMetadata('news.newTitle');
}

export default async function NewPage(): Promise<ReactElement> {
  await requireAdminPage();
  await connection();
  const today = toDateInputValue(new Date());
  const t = await getTranslations('admin.news');
  return (
    <>
      <PageHeader title={t('newTitle')} backHref="/admin/news" backLabel={t('back')} />
      <NewsForm initial={null} today={today} />
    </>
  );
}
