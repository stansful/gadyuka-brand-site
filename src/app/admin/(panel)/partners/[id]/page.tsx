import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { PartnerForm } from "@/components/admin/forms/PartnerForm";
import { PageHeader } from "@/components/admin/ui/layout";
import { getPartnerForm } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Партнёр" };

export default async function EditPage({ params }: PageProps<"/admin/partners/[id]">): Promise<ReactElement> {
  const { id } = await params;
  const partner = await getPartnerForm(id);
  if (!partner) notFound();
  return (
    <>
      <PageHeader title={partner.name} backHref="/admin/partners" backLabel="Все партнёры" />
      <PartnerForm key={partner.id} initial={partner} />
    </>
  );
}
