import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { NewsForm } from "@/components/admin/forms/NewsForm";
import { PageHeader } from "@/components/admin/ui/layout";
import { getNewsForm } from "@/lib/admin/queries";
import { toDateInputValue } from "@/lib/admin/schemas";

export const metadata: Metadata = { title: "Новость" };

export default async function EditPage({ params }: PageProps<"/admin/news/[id]">): Promise<ReactElement> {
  const { id } = await params;
  const news = await getNewsForm(id);
  if (!news) notFound();
  const today = toDateInputValue(new Date());
  return (
    <>
      <PageHeader title={news.title.ru || news.slug} backHref="/admin/news" backLabel="Все новости" />
      <NewsForm key={news.id} initial={news} today={today} />
    </>
  );
}
