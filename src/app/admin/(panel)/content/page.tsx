import { clsx } from 'clsx';
import { Search, X } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Form from 'next/form';
import Link from 'next/link';

import { SiteTextsForm } from '@/components/admin/forms/SiteTextsForm';
import { Button } from '@/components/admin/ui/Button';
import { TextInput } from '@/components/admin/ui/inputs';
import { EmptyState, PageHeader } from '@/components/admin/ui/layout';
import type { AdminTranslator } from '@/lib/admin/i18n';
import { adminPageMetadata } from '@/lib/admin/i18n-server';
import { getSiteTextsPage } from '@/lib/admin/queries';
import { SITE_TEXT_QUERY_MAX_LENGTH } from '@/lib/admin/site-texts';
import type { SiteTextSectionSummary } from '@/lib/admin/types';

import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export function generateMetadata(): Promise<Metadata> {
  return adminPageMetadata('siteTexts.title');
}

function firstParam(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

/**
 * «Тексты сайта»: every UI text of the public site (Message rows, keys = messages/ru.json),
 * by section (?section=hero) or as search results across sections (?q=…).
 */
export default async function SiteTextsPage({ searchParams }: PageProps<'/admin/content'>): Promise<ReactElement> {
  const params = await searchParams;
  const [data, t] = await Promise.all([
    getSiteTextsPage({ section: firstParam(params.section), query: firstParam(params.q) ?? '' }),
    getTranslations('admin.siteTexts'),
  ]);

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <search className="mb-4 block max-w-xl">
        <Form action="/admin/content" className="flex gap-2">
          <label htmlFor="site-texts-q" className="sr-only">
            {t('searchLabel')}
          </label>
          <TextInput
            key={data.query}
            id="site-texts-q"
            name="q"
            type="search"
            defaultValue={data.query}
            maxLength={SITE_TEXT_QUERY_MAX_LENGTH}
            placeholder={t('searchPlaceholder')}
          />
          <Button type="submit" variant="outline" icon={<Search className="size-4" aria-hidden />}>
            {t('find')}
          </Button>
          {data.mode === 'search' ? (
            <Link
              href="/admin/content"
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm text-fg/80 hover:bg-raised-hi hover:text-fg"
            >
              <X className="size-4" aria-hidden />
              {t('reset')}
            </Link>
          ) : null}
        </Form>
      </search>
      <SectionTabs sections={data.sections} active={data.section} t={t} />
      {data.mode === 'search' && data.groups.length === 0 ? (
        <EmptyState
          icon={<Search aria-hidden />}
          title={t('noResults', { query: data.query })}
          description={t('noResultsHint')}
        />
      ) : data.groups.length > 0 ? (
        <>
          {data.mode === 'search' ? (
            <p className="mb-4 text-sm text-muted">
              {t('resultsCount', {
                count: data.groups.reduce((sum, group) => sum + group.entries.length, 0),
                query: data.query,
              })}
            </p>
          ) : null}
          <SiteTextsForm data={data} />
        </>
      ) : (
        <EmptyState title={t('empty')} description={t('emptyHint')} />
      )}
    </>
  );
}

type SiteTextsTranslator = AdminTranslator<'admin.siteTexts'>;

/** Tooltip of a section tab: «Текстов: 25 · изменено: 2 · без перевода: 1 · нет в базе: 3». */
function sectionTitle(item: SiteTextSectionSummary, t: SiteTextsTranslator): string {
  return [
    t('tabs.total', { count: item.total }),
    item.edited > 0 ? t('tabs.edited', { count: item.edited }) : '',
    item.gaps > 0 ? t('tabs.gaps', { count: item.gaps }) : '',
    item.unsaved > 0 ? t('tabs.unsaved', { count: item.unsaved }) : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

function SectionTabs({
  sections,
  active,
  t,
}: {
  sections: SiteTextSectionSummary[];
  active: string | null;
  t: SiteTextsTranslator;
}): ReactElement {
  return (
    <nav aria-label={t('tabs.label')} className="mb-6 -mx-1 overflow-x-auto pb-1">
      <ul className="flex min-w-max gap-1 px-1">
        {sections.map(item => {
          const current = item.id === active;
          return (
            <li key={item.id}>
              <Link
                href={`/admin/content?section=${encodeURIComponent(item.id)}`}
                aria-current={current ? 'page' : undefined}
                title={sectionTitle(item, t)}
                className={clsx(
                  'inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm whitespace-nowrap transition-colors',
                  current
                    ? 'border-blue bg-blue font-semibold text-fg'
                    : 'border-line text-fg/70 hover:border-line-strong hover:text-fg',
                )}
              >
                {item.label}
                {item.gaps > 0 ? (
                  <>
                    <span
                      className="rounded-full bg-beige/20 px-1.5 text-[10px] text-beige"
                      aria-hidden
                      title={t('tabs.gapsBadge', { count: item.gaps })}
                    >
                      {item.gaps}
                    </span>
                    <span className="sr-only">{t('tabs.gapsSr', { count: item.gaps })}</span>
                  </>
                ) : null}
                {item.unsaved > 0 ? (
                  <span className="sr-only">{t('tabs.unsavedSr', { count: item.unsaved })}</span>
                ) : null}
                {item.edited > 0 ? (
                  <>
                    <span
                      className="size-1.5 rounded-full bg-beige"
                      aria-hidden
                      title={t('tabs.editedDot', { count: item.edited })}
                    />
                    <span className="sr-only">{t('tabs.editedSr', { count: item.edited })}</span>
                  </>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
