import { Plus, X } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { EntityList } from '@/components/admin/lists/EntityList';
import { buttonClasses } from '@/components/admin/ui/Button';
import { PageHeader } from '@/components/admin/ui/layout';
import { adminPageMetadata } from '@/lib/admin/i18n-server';
import { REVIEW_RATING_LIMIT } from '@/lib/admin/limits';
import { listReviewsAdmin } from '@/lib/admin/queries/catalog';

import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export function generateMetadata(): Promise<Metadata> {
  return adminPageMetadata('reviews.title');
}

/** ?ratingAbove=N (link from the settings when the star scale cannot be lowered). */
function parseRatingAbove(value: string | string[] | undefined): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || !/^\d{1,2}$/.test(raw)) return undefined;
  const number = Number(raw);
  return number >= 0 && number <= REVIEW_RATING_LIMIT.max ? number : undefined;
}

export default async function ListPage({ searchParams }: PageProps<'/admin/reviews'>): Promise<ReactElement> {
  const ratingAbove = parseRatingAbove((await searchParams).ratingAbove);
  const [rows, t] = await Promise.all([listReviewsAdmin({ ratingAbove }), getTranslations('admin.reviews')]);
  const addLink = (
    <Link href="/admin/reviews/new" className={buttonClasses('primary')}>
      <Plus className="size-4" aria-hidden />
      {t('add')}
    </Link>
  );
  return (
    <>
      <PageHeader title={t('title')} description={t('description')} actions={<>{addLink}</>} />
      {ratingAbove !== undefined ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-beige/30 bg-beige/5 px-4 py-3 text-sm">
          <span className="text-fg">{t('filtered', { rating: ratingAbove, count: rows.length })}</span>
          <Link
            href="/admin/reviews"
            className="inline-flex items-center gap-1 text-xs font-medium text-beige hover:underline"
          >
            <X className="size-3.5" aria-hidden />
            {t('showAll')}
          </Link>
        </div>
      ) : null}
      <EntityList
        entity="review"
        rows={rows}

        // A filtered list must not be reordered: its positions are not the site's positions.
        sortable={ratingAbove === undefined}
        empty={
          ratingAbove !== undefined
            ? { title: t('emptyFiltered', { rating: ratingAbove }), description: t('emptyFilteredHint') }
            : {
                title: t('empty'),
                description: t('emptyHint'),
                action: addLink,
              }
        }
      />
    </>
  );
}
