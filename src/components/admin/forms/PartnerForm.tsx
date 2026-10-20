'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type ReactElement } from 'react';

import { errorFor } from '@/lib/admin/action-result';
import { savePartner } from '@/lib/admin/actions/partners';
import type { AdminMediaRef, PartnerFormData } from '@/lib/admin/types';
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

const LOCALIZED = ['description'] as const;

export function PartnerForm({ initial }: { initial: PartnerFormData | null }): ReactElement {
  return (
    <EditLocaleProvider>
      <PartnerFormInner initial={initial} />
    </EditLocaleProvider>
  );
}

function PartnerFormInner({ initial }: { initial: PartnerFormData | null }): ReactElement {
  const t = useTranslations('admin');
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? '');
  const [url, setUrl] = useState(initial?.url ?? '');
  const [description, setDescription] = useState<LocalizedText>(initial?.description ?? {});
  const [logo, setLogo] = useState<AdminMediaRef | null>(initial?.logo ?? null);
  const [published, setPublished] = useState(initial?.published ?? false);
  const { pending, fieldErrors, run } = useActionSubmit();

  const submit = (): void => {
    run(
      () =>
        savePartner(initial?.id ?? null, {
          name,
          url: url.trim() === '' ? null : url.trim(),
          description,
          logoId: logo?.id ?? null,
          published,
        }),
      {
        onSuccess: data => {
          if (!initial) router.replace(`/admin/partners/${data.id}`);
        },
      },
    );
  };

  const nameError = errorFor(fieldErrors, 'name');
  const urlError = errorFor(fieldErrors, 'url');

  return (
    <EntityFormShell
      onSubmit={submit}
      pending={pending}
      isNew={initial === null}
      localeGaps={translationGaps([description])}
      localeErrors={localesWithErrors(fieldErrors, LOCALIZED)}
      siteLinks={initial ? siteLinksFor('partners') : undefined}
      remove={initial ? { entity: 'partner', id: initial.id, listHref: '/admin/partners' } : undefined}
      aside={
        <>
          <Card title={t('form.publication')}>
            <Switch checked={published} onCheckedChange={setPublished} label={t('form.showOnSite')} />
          </Card>
          <Card title={t('partners.form.logo')}>
            <MediaPicker
              id="partner-logo"
              label={t('partners.form.logoLabel')}
              value={logo}
              onChange={setLogo}
              error={errorFor(fieldErrors, 'logoId')}
            />
          </Card>
        </>
      }
    >
      <Card title={t('partners.form.main')} bodyClassName="flex flex-col gap-5">
        <Field
          htmlFor="partner-name"
          label={t('partners.form.name')}
          required
          error={nameError}
          hint={t('form.sameInAllLanguages')}
        >
          <TextInput
            id="partner-name"
            value={name}
            onChange={event => setName(event.target.value)}
            invalid={Boolean(nameError)}
            aria-describedby={describedBy('partner-name', true, nameError)}
            aria-required
            maxLength={120}
          />
        </Field>
        <Field htmlFor="partner-url" label={t('partners.form.url')} error={urlError} hint={t('partners.form.urlHint')}>
          <TextInput
            id="partner-url"
            type="url"
            value={url}
            onChange={event => setUrl(event.target.value)}
            invalid={Boolean(urlError)}
            aria-describedby={describedBy('partner-url', true, urlError)}
            maxLength={500}
            placeholder="https://"
            spellCheck={false}
          />
        </Field>
        <LocalizedField
          name="description"
          label={t('partners.form.description')}
          multiline
          rows={5}
          value={description}
          onChange={setDescription}
          fieldErrors={fieldErrors}
          maxLength={3000}
        />
      </Card>
    </EntityFormShell>
  );
}
