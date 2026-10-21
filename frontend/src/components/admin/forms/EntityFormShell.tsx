'use client';

import { ExternalLink, Save, Trash } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useTransition, type ReactElement, type ReactNode } from 'react';
import { toast } from 'sonner';

import { localeNames, type Locale } from '@/i18n/locales';
import { deleteItem } from '@/lib/admin/actions/entities';
import type { PublishableEntityKind } from '@shared/contracts/entities';

import { LocaleTabs, useFocusLocaleWithErrors } from '../i18n/LocaleTabs';
import { Button } from '../ui/Button';
import { Card } from '../ui/layout';
import { useConfirm } from '../ui/useConfirm';

/** «На сайте RU» — a link to where the edited thing is shown, per site language. */
export type SiteLink = { locale: Locale; href: string };

/**
 * Common frame of every entity edit form: sticky bar with language tabs and «Сохранить»
 * (also Ctrl/⌘+S), main column + side column, delete with confirmation.
 * Must be rendered inside <EditLocaleProvider>.
 */
export function EntityFormShell({
  onSubmit,
  pending,
  isNew,
  localeGaps,
  localeErrors,
  aside,
  children,
  siteLinks,
  remove,
}: {
  onSubmit: () => void;
  pending: boolean;
  isNew: boolean;
  localeGaps?: Partial<Record<Locale, number>>;
  localeErrors?: Set<Locale>;
  aside?: ReactNode;
  children: ReactNode;
  siteLinks?: SiteLink[];
  /** Delete button (existing rows only); confirmations name it admin.entities.accusative.<entity>. */
  remove?: {
    entity: PublishableEntityKind;
    id: string;
    listHref: string;
    warning?: string;
    /** The row has pictures: say they stay in the media library (default true). */
    withMedia?: boolean;
  };
}): ReactElement {
  const t = useTranslations('admin');
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [deleting, startDelete] = useTransition();
  const [confirmDialog, confirm] = useConfirm();
  useFocusLocaleWithErrors(localeErrors);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        // Not while a dialog (media library, confirmation) is open on top of the form.
        if (document.querySelector('dialog[open]')) return;
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const onDelete = async (): Promise<void> => {
    if (!remove) return;
    const confirmed = await confirm({
      title: t('form.deleteTitle', { noun: t(`entities.accusative.${remove.entity}`) }),
      description: (
        <>
          {t('form.irreversible')}
          {remove.warning ? <strong className="mt-2 block text-red-fg">{remove.warning}</strong> : null}
          {remove.withMedia === false ? null : <span className="mt-2 block">{t('form.mediaStays')}</span>}
        </>
      ),
    });
    if (!confirmed) return;
    startDelete(async () => {
      try {
        const result = await deleteItem(remove.entity, remove.id);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(result.message ?? t('form.deleted'));
        router.push(remove.listHref);
      } catch {
        toast.error(t('errors.network'));
      }
    });
  };

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={event => {
        event.preventDefault();
        if (!pending) onSubmit();
      }}
      className="flex flex-col gap-6"
    >
      <div className="sticky top-14 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-ink/90 px-4 py-3 backdrop-blur md:-mx-6 md:px-6 lg:top-0 lg:-mx-8 lg:px-8">
        <LocaleTabs gaps={localeGaps} errors={localeErrors} />
        <div className="flex flex-wrap items-center gap-2">
          {siteLinks?.map(link => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-sm text-fg/80 hover:bg-raised-hi hover:text-fg"
            >
              <ExternalLink className="size-4" aria-hidden />
              {t('form.onSite', { language: localeNames[link.locale].short })}
            </a>
          ))}
          <Button type="submit" variant="primary" pending={pending} icon={<Save className="size-4" aria-hidden />}>
            {t(isNew ? 'form.create' : 'form.save')}
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">{children}</div>
        <div className="flex min-w-0 flex-col gap-6">
          {aside}
          {remove ? (
            <Card title={t('form.deletion')} bodyClassName="flex flex-col gap-3">
              <p className="text-xs text-muted">
                {t('form.deletionText', { noun: t(`entities.accusative.${remove.entity}`) })}
              </p>
              <div>
                <Button
                  variant="danger"
                  size="sm"
                  pending={deleting}
                  icon={<Trash className="size-4" aria-hidden />}
                  onClick={() => void onDelete()}
                >
                  {t('form.delete')}
                </Button>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
      {confirmDialog}
    </form>
  );
}
