import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CollectionForm } from '@/components/admin/forms/CollectionForm';
import { PageHeader } from '@/components/admin/ui/layout';
import { adminPageMetadata } from '@/lib/admin/i18n-server';
import { getCollectionForm } from '@/lib/admin/queries/catalog';

import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export function generateMetadata(): Promise<Metadata> {
  return adminPageMetadata('collections.editTitle');
}

export default async function EditCollectionPage({
  params,
}: PageProps<'/admin/collections/[id]'>): Promise<ReactElement> {
  const { id } = await params;
  const [collection, t, tCommon] = await Promise.all([
    getCollectionForm(id),
    getTranslations('admin.collections'),
    getTranslations('admin.common'),
  ]);
  if (!collection) notFound();
  return (
    <>
      <PageHeader
        title={collection.title.ru || collection.slug}
        backHref="/admin/collections"
        backLabel={t('back')}
        description={
          <>
            {tCommon('products', { count: collection.productCount })} ·{' '}
            <Link href="/admin/products" className="text-beige hover:underline">
              {t('goToProducts')}
            </Link>
          </>
        }
      />
      <CollectionForm key={collection.id} initial={collection} />
    </>
  );
}
