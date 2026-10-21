import { Plus, Shirt } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { EntityList } from '@/components/admin/lists/EntityList';
import { buttonClasses } from '@/components/admin/ui/Button';
import { Badge, EmptyState, PageHeader } from '@/components/admin/ui/layout';
import { adminPageMetadata } from '@/lib/admin/i18n-server';
import { listProductsAdmin } from '@/lib/admin/queries/catalog';

import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export function generateMetadata(): Promise<Metadata> {
  return adminPageMetadata('products.title');
}

export default async function ProductsPage(): Promise<ReactElement> {
  const [groups, t, tCommon] = await Promise.all([
    listProductsAdmin(),
    getTranslations('admin.products'),
    getTranslations('admin.common'),
  ]);

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          groups.length > 0 ? (
            <Link href="/admin/products/new" className={buttonClasses('primary')}>
              <Plus className="size-4" aria-hidden />
              {t('add')}
            </Link>
          ) : null
        }
      />
      {groups.length === 0 ? (
        <EmptyState
          icon={<Shirt aria-hidden />}
          title={t('noCollections')}
          description={t('noCollectionsHint')}
          action={
            <Link href="/admin/collections/new" className={buttonClasses('primary', 'sm')}>
              {t('newCollection')}
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map(group => (
            <section key={group.collection.id} aria-labelledby={`collection-${group.collection.id}`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id={`collection-${group.collection.id}`} className="text-base font-semibold">
                    <Link href={`/admin/collections/${group.collection.id}`} className="hover:text-beige">
                      {group.collection.title}
                    </Link>
                  </h2>
                  {!group.collection.published ? <Badge>{t('collectionHidden')}</Badge> : null}
                  <span className="text-xs text-muted">{tCommon('products', { count: group.rows.length })}</span>
                </div>
                <Link
                  href={`/admin/products/new?collection=${group.collection.id}`}
                  className={buttonClasses('outline', 'sm')}
                >
                  <Plus className="size-4" aria-hidden />
                  {t('addToCollection')}
                </Link>
              </div>
              <EntityList entity="product" rows={group.rows} empty={{ title: t('emptyCollection') }} />
            </section>
          ))}
        </div>
      )}
    </>
  );
}
