import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { ReviewForm } from '@/components/admin/forms/ReviewForm';
import { PageHeader } from '@/components/admin/ui/layout';
import { adminPageMetadata } from '@/lib/admin/i18n-server';
import { getReviewForm, getReviewRatingMax } from '@/lib/admin/queries/catalog';

import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export function generateMetadata(): Promise<Metadata> {
  return adminPageMetadata('reviews.editTitle');
}

export default async function EditPage({ params }: PageProps<'/admin/reviews/[id]'>): Promise<ReactElement> {
  const { id } = await params;
  const [review, ratingMax, t] = await Promise.all([
    getReviewForm(id),
    getReviewRatingMax(),
    getTranslations('admin.reviews'),
  ]);
  if (!review) notFound();
  return (
    <>
      <PageHeader title={review.author} backHref="/admin/reviews" backLabel={t('back')} />
      <ReviewForm key={review.id} initial={review} ratingMax={ratingMax} />
    </>
  );
}
