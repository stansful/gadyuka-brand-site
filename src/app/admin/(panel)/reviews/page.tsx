import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";
import { EntityList } from "@/components/admin/lists/EntityList";
import { buttonClasses } from "@/components/admin/ui/Button";
import { PageHeader } from "@/components/admin/ui/layout";
import { listReviewsAdmin } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Отзывы" };

export default async function ListPage(): Promise<ReactElement> {
  const rows = await listReviewsAdmin();
  const addLink = (
    <Link href="/admin/reviews/new" className={buttonClasses("primary")}>
      <Plus className="size-4" aria-hidden />
      Новый отзыв
    </Link>
  );
  return (
    <>
      <PageHeader
        title="Отзывы"
        description="Отзывы покупателей. Перетаскивайте строки, чтобы изменить порядок на сайте."
        actions={
          <>
            {addLink}
          </>
        }
      />
      <EntityList
        entity="review"
        rows={rows}
        nounAccusative="отзыв"
        empty={{ title: "Отзывов пока нет", description: "Добавьте отзывы покупателей — они появятся в разделе «Отзывы» на сайте.", action: addLink }}
      />
    </>
  );
}
