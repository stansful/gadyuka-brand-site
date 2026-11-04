import { getTranslations } from 'next-intl/server';
import { type ReactElement } from 'react';

import { Card, PageHeader } from '@/components/admin/ui/layout';
import { VisitsChart } from '@/components/admin/visits/VisitsChart';
import {
  VisitsFilters,
  type VisitsFilterPreset,
  type VisitsFiltersState,
} from '@/components/admin/visits/VisitsFilters';
import { VisitsTable } from '@/components/admin/visits/VisitsTable';
import { adminPageMetadata } from '@/lib/admin/i18n-server';
import { getVisitsRecent, getVisitsStats } from '@/lib/admin/queries/visits';

import type { Metadata } from 'next';

/**
 * Reads visits stats and recent entries at request time; the data fetch is not cacheable
 * during prerendering, so this route must not claim instant navigation.
 */
export const instant = false;

export function generateMetadata(): Promise<Metadata> {
  return adminPageMetadata('visits.title');
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultRange(): { from: string; to: string } {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - 6);
  return { from: formatDateInput(from), to: formatDateInput(today) };
}

export default async function VisitsPage({ searchParams }: PageProps<'/admin/visits'>): Promise<ReactElement> {
  const params = await searchParams;
  const range = ((): { from: string; to: string } => {
    const from = first(params.from);
    const to = first(params.to);
    if (from && to) return { from, to };
    return defaultRange();
  })();

  const granularity: VisitsFiltersState['granularity'] = first(params.granularity) === 'hour' ? 'hour' : 'day';
  const chartType: VisitsFiltersState['chartType'] = first(params.chartType) === 'bar' ? 'bar' : 'line';
  const preset: VisitsFilterPreset = (first(params.preset) as VisitsFilterPreset | undefined) ?? '7days';

  const [stats, recent, t] = await Promise.all([
    getVisitsStats({ ...range, granularity }),
    getVisitsRecent(),
    getTranslations('admin.visits'),
  ]);

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <VisitsFilters value={{ preset, ...range, granularity, chartType }} />

      <div className="mb-2 flex items-center justify-end">
        <span className="text-sm text-muted">
          {stats.total} {t('uniqueVisitors')}
        </span>
      </div>

      <VisitsChart points={stats.points} granularity={granularity} chartType={chartType} noDataLabel={t('noData')} />

      <Card title={t('recent')} className="mt-6" bodyClassName="p-0">
        <VisitsTable visits={recent.visits} />
      </Card>
    </>
  );
}
