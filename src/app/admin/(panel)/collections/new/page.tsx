import type { Metadata } from "next";
import type { ReactElement } from "react";
import { CollectionForm } from "@/components/admin/forms/CollectionForm";
import { PageHeader } from "@/components/admin/ui/layout";
import { requireAdminPage } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "Новая коллекция" };

export default async function NewCollectionPage(): Promise<ReactElement> {
  await requireAdminPage();
  return (
    <>
      <PageHeader title="Новая коллекция" backHref="/admin/collections" backLabel="Все коллекции" />
      <CollectionForm initial={null} />
    </>
  );
}
