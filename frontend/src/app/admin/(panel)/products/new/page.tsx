import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { ProductForm } from '@/components/admin/forms/ProductForm';
import { buttonClasses } from '@/components/admin/ui/Button';
import { EmptyState, PageHeader } from '@/components/admin/ui/layout';
import { adminPageMetadata } from '@/lib/admin/i18n-server';
import { getCollectionOptions } from '@/lib/admin/queries/catalog';

import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export function generateMetadata(): Promise<Metadata> {
  return adminPageMetadata('products.newTitle');
}

export default async function NewProductPage({
  searchParams,
}: PageProps<'/admin/products/new'>): Promise<ReactElement> {
  const [collections, params, t] = await Promise.all([
    getCollectionOptions(),
    searchParams,
    getTranslations('admin.products'),
  ]);
  const requested = Array.isArray(params.collection) ? params.collection[0] : params.collection;
  const defaultCollectionId = collections.some(collection => collection.id === requested) ? requested : undefined;

  return (
    <>
      <PageHeader title={t('newTitle')} backHref="/admin/products" backLabel={t('back')} />
      {collections.length === 0 ? (
        <EmptyState
          title={t('noCollections')}
          action={
            <Link href="/admin/collections/new" className={buttonClasses('primary', 'sm')}>
              {t('newCollection')}
            </Link>
          }
        />
      ) : (
        <ProductForm initial={null} collections={collections} defaultCollectionId={defaultCollectionId} />
      )}
    </>
  );
}
