import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";
import { ProductForm } from "@/components/admin/forms/ProductForm";
import { buttonClasses } from "@/components/admin/ui/Button";
import { EmptyState, PageHeader } from "@/components/admin/ui/layout";
import { getCollectionOptions } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Новый товар" };

export default async function NewProductPage({ searchParams }: PageProps<"/admin/products/new">): Promise<ReactElement> {
  const [collections, params] = await Promise.all([getCollectionOptions(), searchParams]);
  const requested = Array.isArray(params.collection) ? params.collection[0] : params.collection;
  const defaultCollectionId = collections.some((collection) => collection.id === requested) ? requested : undefined;

  return (
    <>
      <PageHeader title="Новый товар" backHref="/admin/products" backLabel="Все товары" />
      {collections.length === 0 ? (
        <EmptyState
          title="Сначала создайте коллекцию"
          action={
            <Link href="/admin/collections/new" className={buttonClasses("primary", "sm")}>
              Новая коллекция
            </Link>
          }
        />
      ) : (
        <ProductForm initial={null} collections={collections} defaultCollectionId={defaultCollectionId} />
      )}
    </>
  );
}
