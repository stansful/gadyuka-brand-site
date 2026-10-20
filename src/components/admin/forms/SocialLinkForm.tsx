'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type ReactElement } from 'react';

import { defaultLocale } from '@/i18n/locales';
import { errorFor } from '@/lib/admin/action-result';
import { saveSocialLink } from '@/lib/admin/actions/socials';
import { SOCIAL_URL_PLACEHOLDERS } from '@/lib/admin/labels';
import type { SocialLinkFormData } from '@/lib/admin/types';
import { isSocialType, SOCIAL_TYPES, type SocialType } from '@/lib/content/social';
import type { LocalizedText } from '@/lib/i18n-text';

import { EditLocaleProvider, localesWithErrors, useEditLocale } from '../i18n/LocaleTabs';
import { LocalizedField } from '../i18n/LocalizedField';
import { describedBy, Field } from '../ui/Field';
import { Select, TextInput } from '../ui/inputs';
import { Card } from '../ui/layout';
import { Switch } from '../ui/Switch';
import { useActionSubmit } from '../ui/useActionSubmit';
import { EntityFormShell } from './EntityFormShell';
import { siteLinksFor } from './site-links';

const LOCALIZED = ['label'] as const;

type SocialLinkFormProps = {
  initial: SocialLinkFormData | null;
  /** What the site shows without an own label: the «Тексты сайта» value of `social.<TYPE>`. */
  defaultLabels: Record<SocialType, LocalizedText>;
};

export function SocialLinkForm(props: SocialLinkFormProps): ReactElement {
  return (
    <EditLocaleProvider>
      <SocialLinkFormInner {...props} />
    </EditLocaleProvider>
  );
}

function SocialLinkFormInner({ initial, defaultLabels }: SocialLinkFormProps): ReactElement {
  const t = useTranslations('admin');
  const router = useRouter();
  const { locale } = useEditLocale();
  const [type, setType] = useState<SocialType>(initial?.type ?? 'TELEGRAM');
  const [url, setUrl] = useState(initial?.url ?? '');
  const [label, setLabel] = useState<LocalizedText>(initial?.label ?? {});
  const [published, setPublished] = useState(initial?.published ?? true);
  const { pending, fieldErrors, run } = useActionSubmit();

  const submit = (): void => {
    run(() => saveSocialLink(initial?.id ?? null, { type, url: url.trim(), label, published }), {
      onSuccess: data => {
        if (!initial) router.replace(`/admin/socials/${data.id}`);
      },
    });
  };

  const typeError = errorFor(fieldErrors, 'type');
  const urlError = errorFor(fieldErrors, 'url');
  const urlHint = t('socials.form.urlHint');
  const fallbackLabel = defaultLabels[type][locale] || defaultLabels[type][defaultLocale] || t(`socials.types.${type}`);

  return (
    <EntityFormShell
      onSubmit={submit}
      pending={pending}
      isNew={initial === null}
      localeErrors={localesWithErrors(fieldErrors, LOCALIZED)}
      siteLinks={initial ? siteLinksFor('contacts') : undefined}
      remove={
        initial ? { entity: 'socialLink', id: initial.id, listHref: '/admin/socials', withMedia: false } : undefined
      }
      aside={
        <Card title={t('form.publication')}>
          <Switch
            checked={published}
            onCheckedChange={setPublished}
            label={t('form.showOnSite')}
            description={t('socials.form.showOnSiteHint')}
          />
        </Card>
      }
    >
      <Card title={t('socials.form.main')} bodyClassName="flex flex-col gap-5">
        <Field htmlFor="social-type" label={t('socials.form.type')} required error={typeError}>
          <Select
            id="social-type"
            value={type}
            onChange={event => {
              if (isSocialType(event.target.value)) setType(event.target.value);
            }}
            invalid={Boolean(typeError)}
            aria-describedby={describedBy('social-type', null, typeError)}
            className="max-w-xs"
          >
            {SOCIAL_TYPES.map(option => (
              <option key={option} value={option}>
                {t(`socials.types.${option}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field htmlFor="social-url" label={t('socials.form.url')} required hint={urlHint} error={urlError}>
          <TextInput
            id="social-url"
            type="url"
            value={url}
            onChange={event => setUrl(event.target.value)}
            invalid={Boolean(urlError)}
            aria-describedby={describedBy('social-url', urlHint, urlError)}
            aria-required
            maxLength={500}
            spellCheck={false}
            placeholder={SOCIAL_URL_PLACEHOLDERS[type]}
          />
        </Field>
        <LocalizedField
          name="label"
          label={t('socials.form.label')}
          value={label}
          onChange={setLabel}
          fieldErrors={fieldErrors}
          maxLength={60}
          placeholder={fallbackLabel}
          hint={t('socials.form.labelHint', { label: fallbackLabel })}
        />
      </Card>
    </EntityFormShell>
  );
}
