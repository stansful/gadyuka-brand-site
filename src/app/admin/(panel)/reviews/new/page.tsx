import type { Metadata } from "next";
import type { ReactElement } from "react";
import { ReviewForm } from "@/components/admin/forms/ReviewForm";
import { PageHeader } from "@/components/admin/ui/layout";
import { requireAdminPage } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "Новый отзыв" };

export default async function NewPage(): Promise<ReactElement> {
  await requireAdminPage();
  return (
    <>
      <PageHeader title="Новый отзыв" backHref="/admin/reviews" backLabel="Все отзывы" />
      <ReviewForm initial={null} />
    </>
  );
}
