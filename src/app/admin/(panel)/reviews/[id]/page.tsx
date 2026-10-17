import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { ReviewForm } from "@/components/admin/forms/ReviewForm";
import { PageHeader } from "@/components/admin/ui/layout";
import { getReviewForm } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Отзыв" };

export default async function EditPage({ params }: PageProps<"/admin/reviews/[id]">): Promise<ReactElement> {
  const { id } = await params;
  const review = await getReviewForm(id);
  if (!review) notFound();
  return (
    <>
      <PageHeader title={review.author} backHref="/admin/reviews" backLabel="Все отзывы" />
      <ReviewForm key={review.id} initial={review} />
    </>
  );
}
