import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { ProductForm } from '@/components/admin/forms/ProductForm';
import { PageHeader } from '@/components/admin/ui/layout';
import { adminPageMetadata } from '@/lib/admin/i18n-server';
import { getCollectionOptions, getProductForm } from '@/lib/admin/queries';

import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export function generateMetadata(): Promise<Metadata> {
  return adminPageMetadata('products.editTitle');
}

export default async function EditProductPage({ params }: PageProps<'/admin/products/[id]'>): Promise<ReactElement> {
  const { id } = await params;
  const [product, collections, t] = await Promise.all([
    getProductForm(id),
    getCollectionOptions(),
    getTranslations('admin.products'),
  ]);
  if (!product) notFound();
  return (
    <>
      <PageHeader title={product.title.ru || product.slug} backHref="/admin/products" backLabel={t('back')} />
      <ProductForm key={product.id} initial={product} collections={collections} />
    </>
  );
}
