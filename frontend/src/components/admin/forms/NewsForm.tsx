'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type ReactElement } from 'react';

import { errorFor } from '@/lib/admin/action-result';
import { saveNews } from '@/lib/admin/actions/news';
import { slugify } from '@/lib/admin/slug';
import type { AdminMediaRef, NewsFormData } from '@/lib/admin/types';
import type { LocalizedText } from '@/lib/i18n-text';

import { EditLocaleProvider, localesWithErrors, translationGaps } from '../i18n/LocaleTabs';
import { LocalizedField } from '../i18n/LocalizedField';
import { MediaPicker } from '../media/MediaPicker';
import { describedBy, Field } from '../ui/Field';
import { TextInput } from '../ui/inputs';
import { Card } from '../ui/layout';
import { Switch } from '../ui/Switch';
import { useActionSubmit } from '../ui/useActionSubmit';
import { EntityFormShell } from './EntityFormShell';
import { siteLinksFor } from './site-links';
import { SlugField } from './SlugField';

const LOCALIZED = ['title', 'excerpt', 'body'] as const;

export function NewsForm({ initial, today }: { initial: NewsFormData | null; today: string }): ReactElement {
  return (
    <EditLocaleProvider>
      <NewsFormInner initial={initial} today={today} />
    </EditLocaleProvider>
  );
}

function NewsFormInner({ initial, today }: { initial: NewsFormData | null; today: string }): ReactElement {
  const t = useTranslations('admin');
  const router = useRouter();
  const [title, setTitle] = useState<LocalizedText>(initial?.title ?? {});
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(initial !== null);
  const [date, setDate] = useState(initial?.date ?? today);
  const [excerpt, setExcerpt] = useState<LocalizedText>(initial?.excerpt ?? {});
  const [body, setBody] = useState<LocalizedText>(initial?.body ?? {});
  const [image, setImage] = useState<AdminMediaRef | null>(initial?.image ?? null);
  const [published, setPublished] = useState(initial?.published ?? false);
  const { pending, fieldErrors, run } = useActionSubmit();

  const submit = (): void => {
    run(
      () => saveNews(initial?.id ?? null, { slug, title, excerpt, body, date, imageId: image?.id ?? null, published }),
      {
        onSuccess: data => {
          if (!initial) router.replace(`/admin/news/${data.id}`);
        },
      },
    );
  };

  const dateError = errorFor(fieldErrors, 'date');

  return (
    <EntityFormShell
      onSubmit={submit}
      pending={pending}
      isNew={initial === null}
      localeGaps={translationGaps([title, excerpt, body])}
      localeErrors={localesWithErrors(fieldErrors, LOCALIZED)}
      siteLinks={initial ? siteLinksFor('news') : undefined}
      remove={initial ? { entity: 'news', id: initial.id, listHref: '/admin/news' } : undefined}
      aside={
        <>
          <Card title={t('form.publication')} bodyClassName="flex flex-col gap-5">
            <Switch checked={published} onCheckedChange={setPublished} label={t('form.showOnSite')} />
            <Field
              htmlFor="news-date"
              label={t('news.form.date')}
              required
              error={dateError}
              hint={t('news.form.dateHint')}
            >
              <TextInput
                id="news-date"
                type="date"
                value={date}
                onChange={event => setDate(event.target.value)}
                invalid={Boolean(dateError)}
                aria-describedby={describedBy('news-date', true, dateError)}
                aria-required
              />
            </Field>
          </Card>
          <Card title={t('news.form.image')}>
            <MediaPicker
              id="news-image"
              label={t('news.form.imageLabel')}
              value={image}
              onChange={setImage}
              aspect="wide"
              error={errorFor(fieldErrors, 'imageId')}
            />
          </Card>
        </>
      }
    >
      <Card title={t('news.form.main')} bodyClassName="flex flex-col gap-5">
        <LocalizedField
          name="title"
          label={t('news.form.headline')}
          required
          value={title}
          onChange={next => {
            setTitle(next);
            if (!slugTouched) setSlug(slugify(next.ru ?? ''));
          }}
          fieldErrors={fieldErrors}
          maxLength={200}
        />
        <SlugField
          id="news-slug"
          value={slug}
          onChange={next => {
            setSlugTouched(true);
            setSlug(next);
          }}
          source={title.ru ?? ''}
          error={fieldErrors.slug}
        />
        <LocalizedField
          name="excerpt"
          label={t('news.form.excerpt')}
          multiline
          rows={3}
          value={excerpt}
          onChange={setExcerpt}
          fieldErrors={fieldErrors}
          maxLength={1000}
        />
        <LocalizedField
          name="body"
          label={t('news.form.body')}
          multiline
          rows={10}
          value={body}
          onChange={setBody}
          fieldErrors={fieldErrors}
          maxLength={20000}
          hint={t('news.form.bodyHint')}
        />
      </Card>
    </EntityFormShell>
  );
}
