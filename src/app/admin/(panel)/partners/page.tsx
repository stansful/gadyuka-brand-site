import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";
import { EntityList } from "@/components/admin/lists/EntityList";
import { buttonClasses } from "@/components/admin/ui/Button";
import { PageHeader } from "@/components/admin/ui/layout";
import { listPartnersAdmin } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Партнёры" };

export default async function ListPage(): Promise<ReactElement> {
  const rows = await listPartnersAdmin();
  const addLink = (
    <Link href="/admin/partners/new" className={buttonClasses("primary")}>
      <Plus className="size-4" aria-hidden />
      Новый партнёр
    </Link>
  );
  return (
    <>
      <PageHeader
        title="Партнёры"
        description="Партнёры бренда. Перетаскивайте строки, чтобы изменить порядок на сайте."
        actions={
          <>
            {addLink}
          </>
        }
      />
      <EntityList
        entity="partner"
        rows={rows}
        nounAccusative="партнёра"
        empty={{ title: "Партнёров пока нет", description: "Бренды и организации, с которыми сотрудничает ГАДЮКА.", action: addLink }}
      />
    </>
  );
}
