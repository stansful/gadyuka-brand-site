'use client';

import { useTranslations } from 'next-intl';
import { type ReactElement } from 'react';

import { formatDateTimeRu } from '@/lib/admin/labels';
import type { VisitRecentItem } from '@shared/contracts/visits';

interface VisitsTableProps {
  visits: readonly VisitRecentItem[];
}

function truncate(value: string | null, max = 80): string | null {
  if (!value) return null;
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export function VisitsTable({ visits }: VisitsTableProps): ReactElement {
  const t = useTranslations('admin.visits');

  if (visits.length === 0) {
    return <p className="text-sm text-muted">{t('noData')}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-panel">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th className="px-4 py-3 font-medium">{t('time')}</th>
            <th className="px-4 py-3 font-medium">{t('path')}</th>
            <th className="px-4 py-3 font-medium">{t('userAgent')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {visits.map((visit, i) => (
            <tr key={i} className="hover:bg-raised">
              <td className="px-4 py-3 text-xs text-muted">{formatDateTimeRu(visit.firstAt)}</td>
              <td className="px-4 py-3 font-mono text-xs">{truncate(visit.path) ?? '—'}</td>
              <td className="px-4 py-3 text-xs">{truncate(visit.userAgent) ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
