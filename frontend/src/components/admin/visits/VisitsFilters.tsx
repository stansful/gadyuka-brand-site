'use client';

import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition, type ReactElement } from 'react';

import { Select } from '../ui/inputs';

export type VisitsFilterPreset = 'today' | '7days' | '30days' | 'custom';
export type VisitsGranularity = 'day' | 'hour';
export type VisitsChartType = 'line' | 'bar';

export interface VisitsFiltersState {
  preset: VisitsFilterPreset;
  from: string;
  to: string;
  granularity: VisitsGranularity;
  chartType: VisitsChartType;
}

function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function rangeOfPreset(preset: VisitsFilterPreset): { from: string; to: string } {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const to = formatDateInput(today);
  const fromDate = new Date(today);
  switch (preset) {
    case 'today':
      return { from: to, to };
    case '7days':
      fromDate.setUTCDate(fromDate.getUTCDate() - 6);
      return { from: formatDateInput(fromDate), to };
    case '30days':
      fromDate.setUTCDate(fromDate.getUTCDate() - 29);
      return { from: formatDateInput(fromDate), to };
    default:
      return { from: to, to };
  }
}

export function VisitsFilters({ value }: { value: VisitsFiltersState }): ReactElement {
  const t = useTranslations('admin.visits');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const apply = (next: Partial<VisitsFiltersState>): void => {
    const params = new URLSearchParams(searchParams.toString());
    const merged = { ...value, ...next };

    if (next.preset && next.preset !== 'custom') {
      const range = rangeOfPreset(next.preset);
      merged.from = range.from;
      merged.to = range.to;
    }

    params.set('preset', merged.preset);
    params.set('from', merged.from);
    params.set('to', merged.to);
    params.set('granularity', merged.granularity);
    params.set('chartType', merged.chartType);
    startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
  };

  return (
    <div className="mb-6 flex flex-wrap items-end gap-4" aria-busy={pending || undefined}>
      <div className="flex flex-col gap-1">
        <label htmlFor="visits-preset" className="text-xs text-muted">
          {t('period')}
        </label>
        <Select
          id="visits-preset"
          value={value.preset}
          onChange={event => apply({ preset: event.target.value as VisitsFilterPreset })}
          className="w-40"
        >
          <option value="today">{t('today')}</option>
          <option value="7days">{t('last7Days')}</option>
          <option value="30days">{t('last30Days')}</option>
          <option value="custom">{t('custom')}</option>
        </Select>
      </div>

      {value.preset === 'custom' && (
        <>
          <div className="flex flex-col gap-1">
            <label htmlFor="visits-from" className="text-xs text-muted">
              {t('from')}
            </label>
            <input
              id="visits-from"
              type="date"
              value={value.from}
              onChange={event => apply({ preset: 'custom', from: event.target.value })}
              className="h-10 rounded-md border border-line-strong bg-panel px-3 text-sm text-fg"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="visits-to" className="text-xs text-muted">
              {t('to')}
            </label>
            <input
              id="visits-to"
              type="date"
              value={value.to}
              onChange={event => apply({ preset: 'custom', to: event.target.value })}
              className="h-10 rounded-md border border-line-strong bg-panel px-3 text-sm text-fg"
            />
          </div>
        </>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="visits-granularity" className="text-xs text-muted">
          {t('granularity')}
        </label>
        <Select
          id="visits-granularity"
          value={value.granularity}
          onChange={event => apply({ granularity: event.target.value as VisitsGranularity })}
          className="w-32"
        >
          <option value="day">{t('day')}</option>
          <option value="hour">{t('hour')}</option>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="visits-chart-type" className="text-xs text-muted">
          {t('chartType')}
        </label>
        <Select
          id="visits-chart-type"
          value={value.chartType}
          onChange={event => apply({ chartType: event.target.value as VisitsChartType })}
          className="w-32"
        >
          <option value="line">{t('line')}</option>
          <option value="bar">{t('bar')}</option>
        </Select>
      </div>
    </div>
  );
}
