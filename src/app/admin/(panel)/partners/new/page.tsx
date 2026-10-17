import type { Metadata } from "next";
import type { ReactElement } from "react";
import { PartnerForm } from "@/components/admin/forms/PartnerForm";
import { PageHeader } from "@/components/admin/ui/layout";
import { requireAdminPage } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "Новый партнёр" };

export default async function NewPage(): Promise<ReactElement> {
  await requireAdminPage();
  return (
    <>
      <PageHeader title="Новый партнёр" backHref="/admin/partners" backLabel="Все партнёры" />
      <PartnerForm initial={null} />
    </>
  );
}
