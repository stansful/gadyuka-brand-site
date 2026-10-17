import type { Metadata } from "next";
import type { ReactElement } from "react";
import { OfferForm } from "@/components/admin/forms/OfferForm";
import { PageHeader } from "@/components/admin/ui/layout";
import { requireAdminPage } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "Новое предложение" };

export default async function NewPage(): Promise<ReactElement> {
  await requireAdminPage();
  return (
    <>
      <PageHeader title="Новое предложение" backHref="/admin/offers" backLabel="Все предложения" />
      <OfferForm initial={null} />
    </>
  );
}
