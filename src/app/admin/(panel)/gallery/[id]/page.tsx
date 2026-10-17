import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { GalleryForm } from "@/components/admin/forms/GalleryForm";
import { PageHeader } from "@/components/admin/ui/layout";
import { getGalleryForm } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Фото галереи" };

export default async function EditPage({ params }: PageProps<"/admin/gallery/[id]">): Promise<ReactElement> {
  const { id } = await params;
  const item = await getGalleryForm(id);
  if (!item) notFound();
  return (
    <>
      <PageHeader title={item.caption.ru || "Фото галереи"} backHref="/admin/gallery" backLabel="Вся галерея" />
      <GalleryForm key={item.id} initial={item} />
    </>
  );
}
