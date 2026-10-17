import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";
import { EntityList } from "@/components/admin/lists/EntityList";
import { buttonClasses } from "@/components/admin/ui/Button";
import { PageHeader } from "@/components/admin/ui/layout";
import { listNewsAdmin } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Новости" };

export default async function ListPage(): Promise<ReactElement> {
  const rows = await listNewsAdmin();
  const addLink = (
    <Link href="/admin/news/new" className={buttonClasses("primary")}>
      <Plus className="size-4" aria-hidden />
      Новая новость
    </Link>
  );
  return (
    <>
      <PageHeader
        title="Новости"
        description="Новости и события. На сайте они идут по дате — от новых к старым."
        actions={
          <>
            {addLink}
          </>
        }
      />
      <EntityList
        entity="news"
        rows={rows}
        sortable={false}
        nounAccusative="новость"
        empty={{ title: "Новостей пока нет", description: "Расскажите о запуске коллекции, поп-апах и событиях бренда.", action: addLink }}
      />
    </>
  );
}
