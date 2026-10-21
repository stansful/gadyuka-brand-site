'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type ReactElement } from 'react';

import { errorFor } from '@/lib/admin/action-result';
import { saveGalleryItem } from '@/lib/admin/actions/gallery';
import type { LocalizedText } from '@/lib/localized-text';
import type { MediaRef } from '@shared/contracts/common';
import type { AdminGalleryItemDetails } from '@shared/contracts/content-entities';

import { EditLocaleProvider, localesWithErrors, translationGaps } from '../i18n/LocaleTabs';
import { LocalizedField } from '../i18n/LocalizedField';
import { MediaPicker } from '../media/MediaPicker';
import { Card } from '../ui/layout';
import { Switch } from '../ui/Switch';
import { useActionSubmit } from '../ui/useActionSubmit';
import { EntityFormShell } from './EntityFormShell';
import { siteLinksFor } from './site-links';

const LOCALIZED = ['caption'] as const;

export function GalleryForm({ initial }: { initial: AdminGalleryItemDetails | null }): ReactElement {
  return (
    <EditLocaleProvider>
      <GalleryFormInner initial={initial} />
    </EditLocaleProvider>
  );
}

function GalleryFormInner({ initial }: { initial: AdminGalleryItemDetails | null }): ReactElement {
  const t = useTranslations('admin');
  const router = useRouter();
  const [media, setMedia] = useState<MediaRef | null>(initial?.media ?? null);
  const [caption, setCaption] = useState<LocalizedText>(initial?.caption ?? {});
  const [published, setPublished] = useState(initial?.published ?? true);
  const { pending, fieldErrors, setFieldErrors, run } = useActionSubmit();

  const submit = (): void => {
    if (!media) {
      setFieldErrors({ mediaId: t('gallery.form.chooseImage') });
      return;
    }
    run(() => saveGalleryItem(initial?.id ?? null, { mediaId: media.id, caption, published }), {
      onSuccess: data => {
        if (!initial) router.replace(`/admin/gallery/${data.id}`);
      },
    });
  };

  return (
    <EntityFormShell
      onSubmit={submit}
      pending={pending}
      isNew={initial === null}
      localeGaps={translationGaps([caption])}
      localeErrors={localesWithErrors(fieldErrors, LOCALIZED)}
      siteLinks={initial ? siteLinksFor('gallery') : undefined}
      remove={initial ? { entity: 'gallery', id: initial.id, listHref: '/admin/gallery' } : undefined}
      aside={
        <Card title={t('form.publication')}>
          <Switch checked={published} onCheckedChange={setPublished} label={t('form.showOnSite')} />
        </Card>
      }
    >
      <Card title={t('gallery.form.main')} bodyClassName="flex flex-col gap-5">
        <MediaPicker
          id="gallery-media"
          label={t('gallery.form.image')}
          required
          value={media}
          onChange={setMedia}
          aspect="wide"
          error={errorFor(fieldErrors, 'mediaId')}
          hint={t('gallery.form.altHint')}
        />
        <LocalizedField
          name="caption"
          label={t('gallery.form.caption')}
          value={caption}
          onChange={setCaption}
          fieldErrors={fieldErrors}
          maxLength={300}
        />
      </Card>
    </EntityFormShell>
  );
}
