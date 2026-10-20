import { Layers, Plus } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { EntityList } from '@/components/admin/lists/EntityList';
import { buttonClasses } from '@/components/admin/ui/Button';
import { PageHeader } from '@/components/admin/ui/layout';
import { adminPageMetadata } from '@/lib/admin/i18n-server';
import { listCollectionsAdmin } from '@/lib/admin/queries';

import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export function generateMetadata(): Promise<Metadata> {
  return adminPageMetadata('collections.title');
}

export default async function CollectionsPage(): Promise<ReactElement> {
  const [rows, t] = await Promise.all([listCollectionsAdmin(), getTranslations('admin.collections')]);
  const addLink = (
    <Link href="/admin/collections/new" className={buttonClasses('primary')}>
      <Plus className="size-4" aria-hidden />
      {t('add')}
    </Link>
  );
  return (
    <>
      <PageHeader title={t('title')} description={t('description')} actions={addLink} />
      <EntityList
        entity="collection"
        rows={rows}
        empty={{
          title: t('empty'),
          description: t('emptyHint'),
          action: addLink,
        }}
      />
      <p className="mt-4 flex items-center gap-2 text-xs text-muted">
        <Layers className="size-3.5" aria-hidden />
        {t('productsNote')}
      </p>
    </>
  );
}
