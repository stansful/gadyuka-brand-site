import { Plus } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { EntityList } from '@/components/admin/lists/EntityList';
import { buttonClasses } from '@/components/admin/ui/Button';
import { PageHeader } from '@/components/admin/ui/layout';
import { adminPageMetadata } from '@/lib/admin/i18n-server';
import { listOffersAdmin } from '@/lib/admin/queries/content';

import type { Metadata } from 'next';
import type { ReactElement } from 'react';

/**
 * Request-time auth check and data fetch prevent this route from claiming instant navigation.
 */
export const instant = false;

export function generateMetadata(): Promise<Metadata> {
  return adminPageMetadata('offers.title');
}

export default async function ListPage(): Promise<ReactElement> {
  const [rows, t] = await Promise.all([listOffersAdmin(), getTranslations('admin.offers')]);
  const addLink = (
    <Link href="/admin/offers/new" className={buttonClasses('primary')}>
      <Plus className="size-4" aria-hidden />
      {t('add')}
    </Link>
  );
  return (
    <>
      <PageHeader title={t('title')} description={t('description')} actions={<>{addLink}</>} />
      <EntityList
        entity="offer"
        rows={rows}
        empty={{
          title: t('empty'),
          description: t('emptyHint'),
          action: addLink,
        }}
      />
    </>
  );
}
