import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";
import { EntityList } from "@/components/admin/lists/EntityList";
import { buttonClasses } from "@/components/admin/ui/Button";
import { PageHeader } from "@/components/admin/ui/layout";
import { listOffersAdmin } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Спецпредложения" };

export default async function ListPage(): Promise<ReactElement> {
  const rows = await listOffersAdmin();
  const addLink = (
    <Link href="/admin/offers/new" className={buttonClasses("primary")}>
      <Plus className="size-4" aria-hidden />
      Новое предложение
    </Link>
  );
  return (
    <>
      <PageHeader
        title="Спецпредложения"
        description="Акции и скидки. Истёкшие предложения автоматически скрываются с сайта."
        actions={
          <>
            {addLink}
          </>
        }
      />
      <EntityList
        entity="offer"
        rows={rows}
        nounAccusative="предложение"
        empty={{ title: "Спецпредложений пока нет", description: "Акции и скидки появятся в разделе «Специальные предложения».", action: addLink }}
      />
    </>
  );
}
