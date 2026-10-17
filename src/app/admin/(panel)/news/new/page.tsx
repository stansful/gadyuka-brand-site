import type { Metadata } from "next";
import { connection } from "next/server";
import { toDateInputValue } from "@/lib/admin/schemas";
import type { ReactElement } from "react";
import { NewsForm } from "@/components/admin/forms/NewsForm";
import { PageHeader } from "@/components/admin/ui/layout";
import { requireAdminPage } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "Новая новость" };

export default async function NewPage(): Promise<ReactElement> {
  await requireAdminPage();
  await connection();
  const today = toDateInputValue(new Date());
  return (
    <>
      <PageHeader title="Новая новость" backHref="/admin/news" backLabel="Все новости" />
      <NewsForm initial={null} today={today} />
    </>
  );
}
