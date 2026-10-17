import type { Metadata } from "next";
import type { ReactElement } from "react";
import { MediaLibrary } from "@/components/admin/media/MediaLibrary";
import { PageHeader } from "@/components/admin/ui/layout";
import { getMediaLibrary } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Медиатека" };

export default async function MediaPage(): Promise<ReactElement> {
  const library = await getMediaLibrary();
  return (
    <>
      <PageHeader
        title="Медиатека"
        description="Все изображения сайта. Загруженные файлы автоматически уменьшаются до 2400 px и сохраняются в WebP. Описание (alt) задаётся на каждом языке. Файл, который где-то используется, удалить нельзя."
      />
      <MediaLibrary initial={{ items: library.items, nextCursor: library.nextCursor }} total={library.total} />
    </>
  );
}
