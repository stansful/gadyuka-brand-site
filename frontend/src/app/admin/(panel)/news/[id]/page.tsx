import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { NewsForm } from '@/components/admin/forms/NewsForm';
import { PageHeader } from '@/components/admin/ui/layout';
import { todayInMoscow } from '@/lib/admin/content-entities';
import { adminPageMetadata } from '@/lib/admin/i18n-server';
import { getNewsForm } from '@/lib/admin/queries/content';

import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export function generateMetadata(): Promise<Metadata> {
  return adminPageMetadata('news.editTitle');
}

export default async function EditPage({ params }: PageProps<'/admin/news/[id]'>): Promise<ReactElement> {
  const { id } = await params;
  const [news, t] = await Promise.all([getNewsForm(id), getTranslations('admin.news')]);
  if (!news) notFound();
  const today = todayInMoscow();
  return (
    <>
      <PageHeader title={news.title.ru || news.slug} backHref="/admin/news" backLabel={t('back')} />
      <NewsForm key={news.id} initial={news} today={today} />
    </>
  );
}
