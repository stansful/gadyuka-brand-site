import { getTranslations } from 'next-intl/server';

import { MenuItemForm } from '@/components/admin/forms/MenuItemForm';
import { PageHeader } from '@/components/admin/ui/layout';
import { adminPageMetadata } from '@/lib/admin/i18n-server';
import { getMenuHrefOptions } from '@/lib/admin/queries';

import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export function generateMetadata(): Promise<Metadata> {
  return adminPageMetadata('menu.newTitle');
}

export default async function NewPage(): Promise<ReactElement> {
  const [hrefOptions, t] = await Promise.all([getMenuHrefOptions(), getTranslations('admin.menu')]);
  return (
    <>
      <PageHeader title={t('newTitle')} backHref="/admin/menu" backLabel={t('back')} />
      <MenuItemForm initial={null} hrefOptions={hrefOptions} />
    </>
  );
}
