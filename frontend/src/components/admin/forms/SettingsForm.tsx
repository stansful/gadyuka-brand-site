'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState, type ReactElement } from 'react';

import { errorFor } from '@/lib/admin/action-result';
import { saveSettings } from '@/lib/admin/actions/settings';
import { formatStars } from '@/lib/admin/labels';
import type { LocalizedText } from '@/lib/localized-text';
import type { AdminSiteSettingsResponse } from '@shared/contracts/catalog';
import type { MediaRef } from '@shared/contracts/common';

import { EditLocaleProvider, localesWithErrors, translationGaps } from '../i18n/LocaleTabs';
import { LocalizedField } from '../i18n/LocalizedField';
import { MediaPicker } from '../media/MediaPicker';
import { describedBy, Field } from '../ui/Field';
import { Select, TextInput } from '../ui/inputs';
import { Card } from '../ui/layout';
import { useActionSubmit } from '../ui/useActionSubmit';
import { EntityFormShell } from './EntityFormShell';
import { siteLinksFor } from './site-links';

const LOCALIZED = ['address', 'seoTitle', 'seoDescription'] as const;

/** Choices of the review star scale (SiteSettings.reviewRatingMax, CHECK 1..10). */
const RATING_SCALE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function SettingsForm({ initial }: { initial: AdminSiteSettingsResponse }): ReactElement {
  return (
    <EditLocaleProvider>
      <SettingsFormInner initial={initial} />
    </EditLocaleProvider>
  );
}

function SettingsFormInner({ initial }: { initial: AdminSiteSettingsResponse }): ReactElement {
  const t = useTranslations('admin.settings.form');
  const [phone, setPhone] = useState(initial.phone);
  const [email, setEmail] = useState(initial.email);
  const [address, setAddress] = useState<LocalizedText>(initial.address);
  const [reviewRatingMax, setReviewRatingMax] = useState(initial.reviewRatingMax);
  const [seoTitle, setSeoTitle] = useState<LocalizedText>(initial.seoTitle);
  const [seoDescription, setSeoDescription] = useState<LocalizedText>(initial.seoDescription);
  const [ogImage, setOgImage] = useState<MediaRef | null>(initial.ogImage);
  const { pending, fieldErrors, run } = useActionSubmit();

  const submit = (): void => {
    run(() =>
      saveSettings({
        phone,
        email,
        address,
        reviewRatingMax,
        seoTitle,
        seoDescription,
        ogImageId: ogImage?.id ?? null,
      }),
    );
  };

  const phoneError = errorFor(fieldErrors, 'phone');
  const emailError = errorFor(fieldErrors, 'email');
  const scaleError = errorFor(fieldErrors, 'reviewRatingMax');
  const scaleHint = t('scaleHint');

  return (
    <EntityFormShell
      onSubmit={submit}
      pending={pending}
      isNew={false}
      localeGaps={translationGaps([address, seoTitle, seoDescription])}
      localeErrors={localesWithErrors(fieldErrors, LOCALIZED)}
      siteLinks={siteLinksFor('contacts')}
      aside={
        <Card title={t('og')} description={t('ogHint')}>
          <MediaPicker
            id="settings-og"
            label={t('ogLabel')}
            value={ogImage}
            onChange={setOgImage}
            aspect="wide"
            error={errorFor(fieldErrors, 'ogImageId')}
          />
        </Card>
      }
    >
      <Card title={t('contacts')} description={t('contactsHint')} bodyClassName="flex flex-col gap-5">
        <div className="grid gap-5 md:grid-cols-2">
          <Field htmlFor="settings-phone" label={t('phone')} error={phoneError}>
            <TextInput
              id="settings-phone"
              type="tel"
              value={phone}
              onChange={event => setPhone(event.target.value)}
              invalid={Boolean(phoneError)}
              aria-describedby={describedBy('settings-phone', null, phoneError)}
              maxLength={40}
              placeholder="+7 900 000-00-00"
            />
          </Field>
          <Field htmlFor="settings-email" label={t('email')} error={emailError}>
            <TextInput
              id="settings-email"
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              invalid={Boolean(emailError)}
              aria-describedby={describedBy('settings-email', null, emailError)}
              maxLength={200}
              placeholder="hello@example.ru"
            />
          </Field>
        </div>
        <LocalizedField
          name="address"
          label={t('address')}
          value={address}
          onChange={setAddress}
          fieldErrors={fieldErrors}
          maxLength={300}
          placeholder={t('addressPlaceholder')}
        />
      </Card>

      <Card title={t('reviews')} description={t('reviewsHint')} bodyClassName="flex flex-col gap-3">
        <Field htmlFor="settings-rating-max" label={t('scale')} hint={scaleHint} error={scaleError}>
          <Select
            id="settings-rating-max"
            value={String(reviewRatingMax)}
            onChange={event => setReviewRatingMax(Number(event.target.value))}
            invalid={Boolean(scaleError)}
            aria-describedby={describedBy('settings-rating-max', scaleHint, scaleError)}
            className="max-w-xs"
          >
            {RATING_SCALE_OPTIONS.map(value => (
              <option key={value} value={value}>
                {t('scaleOption', { value, stars: formatStars(value, value) })}
              </option>
            ))}
          </Select>
        </Field>
        {scaleError ? (
          <Link
            href={`/admin/reviews?ratingAbove=${reviewRatingMax}`}
            className="self-start text-xs font-medium text-beige hover:underline"
          >
            {t('reviewsAbove', { max: reviewRatingMax })}
          </Link>
        ) : null}
      </Card>

      <Card title={t('socials')} bodyClassName="text-sm text-muted">
        {t.rich('socialsText', {
          link: chunks => (
            <Link href="/admin/socials" className="font-medium text-beige hover:underline">
              {chunks}
            </Link>
          ),
        })}
      </Card>

      <Card title={t('seo')} description={t('seoHint')} bodyClassName="flex flex-col gap-5">
        <LocalizedField
          name="seoTitle"
          label={t('seoTitle')}
          value={seoTitle}
          onChange={setSeoTitle}
          fieldErrors={fieldErrors}
          maxLength={120}
          hint={t('seoTitleHint')}
        />
        <LocalizedField
          name="seoDescription"
          label={t('seoDescription')}
          multiline
          rows={3}
          value={seoDescription}
          onChange={setSeoDescription}
          fieldErrors={fieldErrors}
          maxLength={400}
          hint={t('seoDescriptionHint')}
        />
      </Card>
    </EntityFormShell>
  );
}
