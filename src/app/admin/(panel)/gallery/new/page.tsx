import type { Metadata } from "next";
import type { ReactElement } from "react";
import { GalleryForm } from "@/components/admin/forms/GalleryForm";
import { PageHeader } from "@/components/admin/ui/layout";
import { requireAdminPage } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "Новое фото" };

export default async function NewPage(): Promise<ReactElement> {
  await requireAdminPage();
  return (
    <>
      <PageHeader title="Новое фото" backHref="/admin/gallery" backLabel="Вся галерея" />
      <GalleryForm initial={null} />
    </>
  );
}
