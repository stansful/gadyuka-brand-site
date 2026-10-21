import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { MenuItemForm } from '@/components/admin/forms/MenuItemForm';
import { PageHeader } from '@/components/admin/ui/layout';
import { adminPageMetadata } from '@/lib/admin/i18n-server';
import { getMenuHrefOptions, getMenuItemForm } from '@/lib/admin/queries/content';
import { readText } from '@/lib/localized-text';

import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export function generateMetadata(): Promise<Metadata> {
  return adminPageMetadata('menu.editTitle');
}

export default async function EditPage({ params }: PageProps<'/admin/menu/[id]'>): Promise<ReactElement> {
  const { id } = await params;
  const [item, hrefOptions, t] = await Promise.all([
    getMenuItemForm(id),
    getMenuHrefOptions(),
    getTranslations('admin.menu'),
  ]);
  if (!item) notFound();
  return (
    <>
      <PageHeader title={readText(item.label, 'ru') || item.href} backHref="/admin/menu" backLabel={t('back')} />
      <MenuItemForm key={item.id} initial={item} hrefOptions={hrefOptions} />
    </>
  );
}
