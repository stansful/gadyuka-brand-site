import { getTranslations } from 'next-intl/server';

import { ReviewForm } from '@/components/admin/forms/ReviewForm';
import { PageHeader } from '@/components/admin/ui/layout';
import { adminPageMetadata } from '@/lib/admin/i18n-server';
import { getReviewRatingMax } from '@/lib/admin/queries/catalog';

import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export function generateMetadata(): Promise<Metadata> {
  return adminPageMetadata('reviews.newTitle');
}

export default async function NewPage(): Promise<ReactElement> {
  const [ratingMax, t] = await Promise.all([getReviewRatingMax(), getTranslations('admin.reviews')]);
  return (
    <>
      <PageHeader title={t('newTitle')} backHref="/admin/reviews" backLabel={t('back')} />
      <ReviewForm initial={null} ratingMax={ratingMax} />
    </>
  );
}
