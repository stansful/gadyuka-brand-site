import { Send, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { LeadStatus, LeadType } from '@shared/contracts/leads';

import type { ReactElement } from 'react';

import { Badge, type BadgeTone } from '../ui/layout';

const statusTones: Record<LeadStatus, BadgeTone> = {
  NEW: 'beige',
  IN_PROGRESS: 'blue',
  DONE: 'neutral',
  SPAM: 'red',
};

/* Server and client components (copy via useTranslations: admin.leads). */

export function LeadStatusBadge({ status }: { status: LeadStatus }): ReactElement {
  const t = useTranslations('admin.leads.statuses');
  return <Badge tone={statusTones[status]}>{t(status)}</Badge>;
}

export function LeadTypeBadge({ type }: { type: LeadType }): ReactElement {
  const t = useTranslations('admin.leads.types');
  return <Badge tone="outline">{t(type)}</Badge>;
}

export function TelegramBadge({ sent }: { sent: boolean }): ReactElement {
  const t = useTranslations('admin.leads.telegram');
  return sent ? (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted" title={t('sent')}>
      <Send className="size-3.5" aria-hidden />
      <span className="sr-only">{t('sent')}</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-fg" title={t('notSent')}>
      <TriangleAlert className="size-3.5" aria-hidden />
      {t('notSentShort')}
    </span>
  );
}
