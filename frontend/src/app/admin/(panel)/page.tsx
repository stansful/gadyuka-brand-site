import { ArrowUpRight, Inbox, TriangleAlert } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { LeadStatusBadge, LeadTypeBadge, TelegramBadge } from '@/components/admin/leads/LeadBadges';
import { buttonClasses } from '@/components/admin/ui/Button';
import { Card, EmptyState, PageHeader } from '@/components/admin/ui/layout';
import { adminPageMetadata } from '@/lib/admin/i18n-server';
import { formatDateTimeRu } from '@/lib/admin/labels';
import { getDashboardData } from '@/lib/admin/queries/dashboard';

import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export function generateMetadata(): Promise<Metadata> {
  return adminPageMetadata('dashboard.title');
}

export default async function DashboardPage(): Promise<ReactElement> {
  const [data, t] = await Promise.all([getDashboardData(), getTranslations('admin.dashboard')]);

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <a href="/" target="_blank" rel="noreferrer" className={buttonClasses('outline', 'md')}>
            {t('openSite')}
            <ArrowUpRight className="size-4" aria-hidden />
          </a>
        }
      />

      <section aria-labelledby="leads-summary" className="mb-6 grid gap-3 sm:grid-cols-3">
        <h2 id="leads-summary" className="sr-only">
          {t('leads')}
        </h2>
        <Link
          href="/admin/leads?status=NEW"
          className="rounded-xl border border-beige/30 bg-beige/5 p-5 transition-colors hover:border-beige/60"
        >
          <p className="text-xs font-medium text-beige">{t('newLeads')}</p>
          <p className="mt-2 text-3xl font-semibold text-fg">{data.leads.fresh}</p>
        </Link>
        <Link
          href="/admin/leads"
          className="rounded-xl border border-line bg-panel p-5 transition-colors hover:border-line-strong"
        >
          <p className="text-xs font-medium text-muted">{t('totalLeads')}</p>
          <p className="mt-2 text-3xl font-semibold text-fg">{data.leads.total}</p>
        </Link>
        <Link
          href="/admin/leads"
          className={
            data.leads.telegramFailed > 0
              ? 'rounded-xl border border-red/50 bg-red/10 p-5 transition-colors hover:border-red-fg'
              : 'rounded-xl border border-line bg-panel p-5 transition-colors hover:border-line-strong'
          }
        >
          <p
            className={
              data.leads.telegramFailed > 0
                ? 'flex items-center gap-1.5 text-xs font-medium text-red-fg'
                : 'text-xs font-medium text-muted'
            }
          >
            {data.leads.telegramFailed > 0 ? <TriangleAlert className="size-3.5" aria-hidden /> : null}
            {t('telegramFailed')}
          </p>
          <p className="mt-2 text-3xl font-semibold text-fg">{data.leads.telegramFailed}</p>
        </Link>
      </section>

      <section aria-labelledby="content-summary" className="mb-8">
        <h2 id="content-summary" className="mb-3 text-sm font-semibold text-fg">
          {t('content')}
        </h2>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {data.counts.map(item => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block rounded-xl border border-line bg-panel p-4 transition-colors hover:border-line-strong"
              >
                <p className="text-xs text-muted">{item.label}</p>
                <p className="mt-1 text-2xl font-semibold">{item.total}</p>
                {item.published !== undefined ? (
                  <p className="mt-1 text-[11px] text-muted">
                    {item.total - item.published > 0
                      ? t('publishedHidden', { published: item.published, hidden: item.total - item.published })
                      : t('published', { published: item.published })}
                  </p>
                ) : null}
                {item.note ? <p className="mt-1 text-[11px] text-muted">{item.note}</p> : null}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Card
        title={t('latestLeads')}
        actions={
          <Link href="/admin/leads" className="text-xs font-medium text-beige hover:underline">
            {t('allLeads')}
          </Link>
        }
        bodyClassName="p-0"
      >
        {data.latestLeads.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={<Inbox aria-hidden />} title={t('noLeads')} description={t('noLeadsHint')} />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {data.latestLeads.map(lead => (
              <li key={lead.id}>
                <Link
                  href={`/admin/leads/${lead.id}`}
                  className="flex flex-col gap-1.5 px-5 py-3 transition-colors hover:bg-raised sm:flex-row sm:items-center sm:gap-4"
                >
                  <span className="w-36 shrink-0 text-xs text-muted">{formatDateTimeRu(lead.createdAt)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{lead.name}</span>
                    <span className="block truncate text-xs text-muted">{lead.preview}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <LeadTypeBadge type={lead.type} />
                    <LeadStatusBadge status={lead.status} />
                    <TelegramBadge sent={lead.telegramSent} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
