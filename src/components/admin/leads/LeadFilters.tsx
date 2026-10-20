'use client';

import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition, type ReactElement } from 'react';

import type { LeadStatus, LeadType } from '@/generated/prisma/enums';
import { LEAD_STATUSES, LEAD_TYPES } from '@/lib/admin/labels';

import { Select } from '../ui/inputs';

/** Type / status filters (URL search params, so the filtered list can be bookmarked). */
export function LeadFilters({ type, status }: { type: LeadType | null; status: LeadStatus | null }): ReactElement {
  const t = useTranslations('admin.leads');
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const apply = (next: { type: string; status: string }): void => {
    const params = new URLSearchParams();
    if (next.type) params.set('type', next.type);
    if (next.status) params.set('status', next.status);
    const query = params.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname));
  };

  return (
    <div className="flex flex-wrap items-end gap-3" aria-busy={pending || undefined}>
      <div className="flex flex-col gap-1">
        <label htmlFor="lead-filter-type" className="text-xs text-muted">
          {t('filters.type')}
        </label>
        <Select
          id="lead-filter-type"
          value={type ?? ''}
          onChange={event => apply({ type: event.target.value, status: status ?? '' })}
          className="w-56"
        >
          <option value="">{t('filters.allTypes')}</option>
          {LEAD_TYPES.map(value => (
            <option key={value} value={value}>
              {t(`types.${value}`)}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="lead-filter-status" className="text-xs text-muted">
          {t('filters.status')}
        </label>
        <Select
          id="lead-filter-status"
          value={status ?? ''}
          onChange={event => apply({ type: type ?? '', status: event.target.value })}
          className="w-44"
        >
          <option value="">{t('filters.allStatuses')}</option>
          {LEAD_STATUSES.map(value => (
            <option key={value} value={value}>
              {t(`statuses.${value}`)}
            </option>
          ))}
        </Select>
      </div>
      {type || status ? (
        <button
          type="button"
          onClick={() => apply({ type: '', status: '' })}
          className="h-10 px-2 text-xs text-muted hover:text-fg"
        >
          {t('filters.reset')}
        </button>
      ) : null}
      {pending ? <span className="h-10 text-xs leading-10 text-muted">{t('filters.loading')}</span> : null}
    </div>
  );
}
