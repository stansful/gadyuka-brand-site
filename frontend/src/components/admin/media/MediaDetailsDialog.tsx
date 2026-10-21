'use client';

import { Copy, ExternalLink, Trash } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState, useTransition, type ReactElement } from 'react';
import { toast } from 'sonner';

import { deleteMedia, updateMediaAlt } from '@/lib/admin/actions/media';
import { fileSizeParts, formatDateTimeRu } from '@/lib/admin/labels';
import type { LocalizedText } from '@/lib/localized-text';

import type { AdminMedia, MediaUsageView } from './media-types';

import { EditLocaleProvider, LocaleTabs, localesWithErrors, translationGaps } from '../i18n/LocaleTabs';
import { LocalizedField } from '../i18n/LocalizedField';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { useActionSubmit } from '../ui/useActionSubmit';
import { useConfirm } from '../ui/useConfirm';
import { fetchMediaDetails, MediaApiError, mediaProblemText } from './media-api';

/** Media details: preview, info, alt text per language, usages, delete (blocked while used). */
export function MediaDetailsDialog({
  media,
  onClose,
  onUpdated,
  onDeleted,
}: {
  media: AdminMedia | null;
  onClose: () => void;
  onUpdated: (media: AdminMedia) => void;
  onDeleted: (id: string) => void;
}): ReactElement {
  const t = useTranslations('admin.media.details');
  return (
    <Modal
      open={media !== null}
      onClose={onClose}
      size="lg"
      title={t('title')}
      description={media?.originalName ?? undefined}
    >
      {media ? (
        <DetailsBody key={media.id} media={media} onUpdated={onUpdated} onDeleted={onDeleted} onClose={onClose} />
      ) : null}
    </Modal>
  );
}

type UsageState =
  | { status: 'loading' }
  | { status: 'ready'; usages: MediaUsageView[] }
  | { status: 'error'; message: string };

function DetailsBody({
  media,
  onUpdated,
  onDeleted,
  onClose,
}: {
  media: AdminMedia;
  onUpdated: (media: AdminMedia) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}): ReactElement {
  const t = useTranslations('admin.media');
  const tErrors = useTranslations('admin.media.errors');
  const tNetwork = useTranslations('admin.errors');
  const [alt, setAlt] = useState<LocalizedText>(media.alt);
  const [usage, setUsage] = useState<UsageState>({ status: 'loading' });
  const [deleting, startDelete] = useTransition();
  const [confirmDialog, confirm] = useConfirm();
  const save = useActionSubmit();

  useEffect(() => {
    const controller = new AbortController();
    fetchMediaDetails(media.id, controller.signal).then(
      details => setUsage({ status: 'ready', usages: details.usages }),
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setUsage({
          status: 'error',
          message: error instanceof MediaApiError ? mediaProblemText(error.problem, tErrors) : t('details.usageFailed'),
        });
      },
    );
    return () => controller.abort();
  }, [media.id, t, tErrors]);

  const usages = usage.status === 'ready' ? usage.usages : [];
  const inUse = usages.length > 0;

  const copyUrl = (): void => {
    const absolute = new URL(media.url, window.location.origin).toString();
    navigator.clipboard.writeText(absolute).then(
      () => toast.success(t('details.copied')),
      () => toast.error(t('details.copyFailed')),
    );
  };

  const onDelete = async (): Promise<void> => {
    const confirmed = await confirm({
      title: t('details.deleteTitle'),
      description: t('details.deleteDescription'),
    });
    if (!confirmed) return;
    startDelete(async () => {
      try {
        const result = await deleteMedia(media.id);
        if (result.ok) {
          toast.success(result.message ?? t('details.deleted'));
          onDeleted(media.id);
          onClose();
          return;
        }
        if ('usages' in result) setUsage({ status: 'ready', usages: result.usages });
        toast.error(result.error);
      } catch {
        toast.error(tNetwork('network'));
      }
    });
  };

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <div className="relative aspect-square overflow-hidden rounded-lg border border-line bg-raised">
          <Image
            src={media.url}
            alt={alt.ru ?? ''}
            fill
            sizes="(min-width: 768px) 420px, 90vw"
            className="object-contain"
          />
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          <dt className="text-muted">{t('details.size')}</dt>
          <dd>
            {t('details.sizeValue', {
              width: media.width,
              height: media.height,
              size: t('fileSize', fileSizeParts(media.size)),
            })}
          </dd>
          <dt className="text-muted">{t('details.format')}</dt>
          <dd>{media.mime}</dd>
          <dt className="text-muted">{t('details.uploaded')}</dt>
          <dd>{formatDateTimeRu(media.createdAt)}</dd>
          <dt className="text-muted">{t('details.url')}</dt>
          <dd className="truncate font-mono" title={media.url}>
            {media.url}
          </dd>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" icon={<Copy className="size-4" aria-hidden />} onClick={copyUrl}>
            {t('details.copyUrl')}
          </Button>
          <a
            href={media.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-2 rounded-md px-3 text-xs font-medium text-fg/80 hover:bg-raised-hi hover:text-fg"
          >
            <ExternalLink className="size-4" aria-hidden />
            {t('details.openFile')}
          </a>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <EditLocaleProvider>
          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={event => {
              event.preventDefault();
              save.run(() => updateMediaAlt(media.id, alt), {
                onSuccess: data => onUpdated({ ...media, alt: data.alt }),
              });
            }}
          >
            <LocaleTabs gaps={translationGaps([alt])} errors={localesWithErrors(save.fieldErrors, ['alt'])} />
            <LocalizedField
              name="alt"
              idPrefix={`media-${media.id}`}
              label={t('details.alt')}
              hint={t('details.altHint')}
              value={alt}
              onChange={setAlt}
              fieldErrors={save.fieldErrors}
              maxLength={300}
            />
            <div>
              <Button type="submit" variant="primary" pending={save.pending}>
                {t('details.saveAlt')}
              </Button>
            </div>
          </form>
        </EditLocaleProvider>

        <section aria-labelledby={`usage-${media.id}`} className="flex flex-col gap-2 border-t border-line pt-4">
          <h3 id={`usage-${media.id}`} className="text-sm font-semibold">
            {t('details.usage')}
          </h3>
          {usage.status === 'loading' ? (
            <p className="text-xs text-muted">{t('details.checking')}</p>
          ) : usage.status === 'error' ? (
            <p className="text-xs text-red-fg">{usage.message}</p>
          ) : usages.length === 0 ? (
            <p className="text-xs text-muted">{t('details.unused')}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {usages.map((item, index) => (
                <li key={`${item.href}-${index}`}>
                  <Link href={item.href} className="text-beige underline-offset-4 hover:underline">
                    {t('details.usageItem', { kind: item.kind, title: item.title })}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="border-t border-line pt-4">
          <Button
            variant="danger"
            size="sm"
            icon={<Trash className="size-4" aria-hidden />}
            pending={deleting}
            disabled={usage.status !== 'ready' || inUse}
            onClick={() => void onDelete()}
          >
            {t('details.delete')}
          </Button>
          {inUse ? <p className="mt-2 text-xs text-muted">{t('details.deleteBlocked')}</p> : null}
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}
