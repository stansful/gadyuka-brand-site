import { Plus, Shirt } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";
import { EntityList } from "@/components/admin/lists/EntityList";
import { buttonClasses } from "@/components/admin/ui/Button";
import { Badge, EmptyState, PageHeader } from "@/components/admin/ui/layout";
import { countRu } from "@/lib/admin/labels";
import { listProductsAdmin } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Товары" };

export default async function ProductsPage(): Promise<ReactElement> {
  const groups = await listProductsAdmin();

  return (
    <>
      <PageHeader
        title="Товары"
        description="Товары по коллекциям. Перетаскивайте строки, чтобы изменить порядок внутри коллекции."
        actions={
          groups.length > 0 ? (
            <Link href="/admin/products/new" className={buttonClasses("primary")}>
              <Plus className="size-4" aria-hidden />
              Новый товар
            </Link>
          ) : null
        }
      />
      {groups.length === 0 ? (
        <EmptyState
          icon={<Shirt aria-hidden />}
          title="Сначала создайте коллекцию"
          description="Каждый товар принадлежит коллекции."
          action={
            <Link href="/admin/collections/new" className={buttonClasses("primary", "sm")}>
              Новая коллекция
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((group) => (
            <section key={group.collection.id} aria-labelledby={`collection-${group.collection.id}`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id={`collection-${group.collection.id}`} className="text-base font-semibold">
                    <Link href={`/admin/collections/${group.collection.id}`} className="hover:text-beige">
                      {group.collection.title}
                    </Link>
                  </h2>
                  {!group.collection.published ? <Badge>коллекция скрыта</Badge> : null}
                  <span className="text-xs text-muted">{countRu(group.rows.length, "товар", "товара", "товаров")}</span>
                </div>
                <Link href={`/admin/products/new?collection=${group.collection.id}`} className={buttonClasses("outline", "sm")}>
                  <Plus className="size-4" aria-hidden />
                  Добавить товар
                </Link>
              </div>
              <EntityList
                entity="product"
                rows={group.rows}
                nounAccusative="товар"
                empty={{ title: "В коллекции пока нет товаров" }}
              />
            </section>
          ))}
        </div>
      )}
    </>
  );
}
