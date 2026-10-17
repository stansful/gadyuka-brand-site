import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { OfferForm } from "@/components/admin/forms/OfferForm";
import { PageHeader } from "@/components/admin/ui/layout";
import { getOfferForm } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Спецпредложение" };

export default async function EditPage({ params }: PageProps<"/admin/offers/[id]">): Promise<ReactElement> {
  const { id } = await params;
  const offer = await getOfferForm(id);
  if (!offer) notFound();
  return (
    <>
      <PageHeader title={offer.title.ru || "Спецпредложение"} backHref="/admin/offers" backLabel="Все предложения" />
      <OfferForm key={offer.id} initial={offer} />
    </>
  );
}
