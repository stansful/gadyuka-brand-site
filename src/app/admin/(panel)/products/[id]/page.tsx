import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { ProductForm } from "@/components/admin/forms/ProductForm";
import { PageHeader } from "@/components/admin/ui/layout";
import { getCollectionOptions, getProductForm } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Товар" };

export default async function EditProductPage({ params }: PageProps<"/admin/products/[id]">): Promise<ReactElement> {
  const { id } = await params;
  const [product, collections] = await Promise.all([getProductForm(id), getCollectionOptions()]);
  if (!product) notFound();
  return (
    <>
      <PageHeader title={product.title.ru || product.slug} backHref="/admin/products" backLabel="Все товары" />
      <ProductForm key={product.id} initial={product} collections={collections} />
    </>
  );
}
