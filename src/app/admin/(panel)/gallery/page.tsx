import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";
import { GalleryBulkAdd } from "@/components/admin/lists/GalleryBulkAdd";
import { EntityList } from "@/components/admin/lists/EntityList";
import { buttonClasses } from "@/components/admin/ui/Button";
import { PageHeader } from "@/components/admin/ui/layout";
import { listGalleryAdmin } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Галерея" };

export default async function ListPage(): Promise<ReactElement> {
  const rows = await listGalleryAdmin();
  const addLink = (
    <Link href="/admin/gallery/new" className={buttonClasses("primary")}>
      <Plus className="size-4" aria-hidden />
      Одно фото
    </Link>
  );
  return (
    <>
      <PageHeader
        title="Галерея"
        description="Фото раздела «Галерея». Перетаскивайте карточки, чтобы изменить порядок."
        actions={
          <>
            <GalleryBulkAdd />
            {addLink}
          </>
        }
      />
      <EntityList
        entity="gallery"
        rows={rows}
        layout="grid"
        nounAccusative="фото из галереи"
        empty={{ title: "В галерее пока нет фото", description: "Добавьте фото из медиатеки или загрузите новые.", action: addLink }}
      />
    </>
  );
}
