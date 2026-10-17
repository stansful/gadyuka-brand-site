import { Layers, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";
import { EntityList } from "@/components/admin/lists/EntityList";
import { buttonClasses } from "@/components/admin/ui/Button";
import { PageHeader } from "@/components/admin/ui/layout";
import { listCollectionsAdmin } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Коллекции" };

export default async function CollectionsPage(): Promise<ReactElement> {
  const rows = await listCollectionsAdmin();
  const addLink = (
    <Link href="/admin/collections/new" className={buttonClasses("primary")}>
      <Plus className="size-4" aria-hidden />
      Новая коллекция
    </Link>
  );
  return (
    <>
      <PageHeader
        title="Коллекции"
        description="Коллекции каталога. Перетаскивайте строки, чтобы изменить порядок на сайте."
        actions={addLink}
      />
      <EntityList
        entity="collection"
        rows={rows}
        nounAccusative="коллекцию"
        empty={{ title: "Коллекций пока нет", description: "Создайте первую коллекцию — затем добавьте в неё товары.", action: addLink }}
      />
      <p className="mt-4 flex items-center gap-2 text-xs text-muted">
        <Layers className="size-3.5" aria-hidden />
        Товары коллекций редактируются в разделе «Товары».
      </p>
    </>
  );
}
