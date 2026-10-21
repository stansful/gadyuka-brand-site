'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type ReactElement } from 'react';

import { errorFor } from '@/lib/admin/action-result';
import { saveCollection } from '@/lib/admin/actions/collections';
import { slugify } from '@/lib/admin/slug';
import type { LocalizedText } from '@/lib/localized-text';
import type { AdminCollectionDetailsResponse } from '@shared/contracts/catalog';
import type { MediaRef } from '@shared/contracts/common';

import { EditLocaleProvider, localesWithErrors, translationGaps } from '../i18n/LocaleTabs';
import { LocalizedField } from '../i18n/LocalizedField';
import { MediaPicker } from '../media/MediaPicker';
import { Card } from '../ui/layout';
import { Switch } from '../ui/Switch';
import { useActionSubmit } from '../ui/useActionSubmit';
import { EntityFormShell } from './EntityFormShell';
import { collectionSiteLinks } from './site-links';
import { SlugField } from './SlugField';

const LOCALIZED = ['title', 'description'] as const;

export function CollectionForm({ initial }: { initial: AdminCollectionDetailsResponse | null }): ReactElement {
  return (
    <EditLocaleProvider>
      <CollectionFormInner initial={initial} />
    </EditLocaleProvider>
  );
}

function CollectionFormInner({ initial }: { initial: AdminCollectionDetailsResponse | null }): ReactElement {
  const t = useTranslations('admin');
  const router = useRouter();
  const [title, setTitle] = useState<LocalizedText>(initial?.title ?? {});
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(initial !== null);
  const [description, setDescription] = useState<LocalizedText>(initial?.description ?? {});
  const [cover, setCover] = useState<MediaRef | null>(initial?.cover ?? null);
  const [published, setPublished] = useState(initial?.published ?? false);
  const { pending, fieldErrors, run } = useActionSubmit();

  const submit = (): void => {
    run(
      () => saveCollection(initial?.id ?? null, { slug, title, description, coverId: cover?.id ?? null, published }),
      {
        onSuccess: data => {
          if (!initial) router.replace(`/admin/collections/${data.id}`);
        },
      },
    );
  };

  return (
    <EntityFormShell
      onSubmit={submit}
      pending={pending}
      isNew={initial === null}
      localeGaps={translationGaps([title, description])}
      localeErrors={localesWithErrors(fieldErrors, LOCALIZED)}
      siteLinks={initial ? collectionSiteLinks(initial.slug) : undefined}
      remove={
        initial
          ? {
              entity: 'collection',
              id: initial.id,
              listHref: '/admin/collections',
              warning:
                initial.productCount > 0 ? t('collections.deleteWarning', { count: initial.productCount }) : undefined,
            }
          : undefined
      }
      aside={
        <>
          <Card title={t('form.publication')}>
            <Switch
              checked={published}
              onCheckedChange={setPublished}
              label={t('form.showOnSite')}
              description={t('collections.form.hiddenHint')}
            />
          </Card>
          <Card title={t('collections.form.cover')}>
            <MediaPicker
              id="collection-cover"
              label={t('collections.form.coverLabel')}
              value={cover}
              onChange={setCover}
              aspect="wide"
              error={errorFor(fieldErrors, 'coverId')}
            />
          </Card>
        </>
      }
    >
      <Card title={t('collections.form.main')} bodyClassName="flex flex-col gap-5">
        <LocalizedField
          name="title"
          label={t('collections.form.name')}
          required
          value={title}
          onChange={next => {
            setTitle(next);
            if (!slugTouched) setSlug(slugify(next.ru ?? ''));
          }}
          fieldErrors={fieldErrors}
          maxLength={200}
          placeholder={t('collections.form.namePlaceholder')}
          hint={t('collections.form.nameHint')}
        />
        <SlugField
          id="collection-slug"
          value={slug}
          onChange={next => {
            setSlugTouched(true);
            setSlug(next);
          }}
          source={title.ru ?? ''}
          error={fieldErrors.slug}
          prefix="/catalog/"
        />
        <LocalizedField
          name="description"
          label={t('collections.form.description')}
          multiline
          rows={5}
          value={description}
          onChange={setDescription}
          fieldErrors={fieldErrors}
          maxLength={5000}
        />
      </Card>
    </EntityFormShell>
  );
}
