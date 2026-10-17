import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { CollectionForm } from "@/components/admin/forms/CollectionForm";
import { PageHeader } from "@/components/admin/ui/layout";
import { countRu } from "@/lib/admin/labels";
import { getCollectionForm } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Коллекция" };

export default async function EditCollectionPage({ params }: PageProps<"/admin/collections/[id]">): Promise<ReactElement> {
  const { id } = await params;
  const collection = await getCollectionForm(id);
  if (!collection) notFound();
  return (
    <>
      <PageHeader
        title={collection.title.ru || collection.slug}
        backHref="/admin/collections"
        backLabel="Все коллекции"
        description={
          <>
            {countRu(collection.productCount, "товар", "товара", "товаров")} ·{" "}
            <Link href="/admin/products" className="text-beige hover:underline">
              перейти к товарам
            </Link>
          </>
        }
      />
      <CollectionForm key={collection.id} initial={collection} />
    </>
  );
}
