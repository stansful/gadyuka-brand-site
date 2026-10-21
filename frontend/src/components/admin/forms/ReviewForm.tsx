'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactElement } from 'react';

import { errorFor } from '@/lib/admin/action-result';
import { saveReview } from '@/lib/admin/actions/reviews';
import type { LocalizedText } from '@/lib/localized-text';
import type { AdminReviewDetailsResponse } from '@shared/contracts/catalog';
import type { MediaRef } from '@shared/contracts/common';

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
import { StarRatingField } from './StarRatingField';

const LOCALIZED = ['role', 'text'] as const;

type ReviewFormProps = {
  initial: AdminReviewDetailsResponse | null;
  /** Current star scale (SiteSettings.reviewRatingMax). */
  ratingMax: number;
};

export function ReviewForm(props: ReviewFormProps): ReactElement {
  return (
    <EditLocaleProvider>
      <ReviewFormInner {...props} />
    </EditLocaleProvider>
  );
}

function ReviewFormInner({ initial, ratingMax }: ReviewFormProps): ReactElement {
  const t = useTranslations('admin');
  const router = useRouter();
  const [author, setAuthor] = useState(initial?.author ?? '');
  const [role, setRole] = useState<LocalizedText>(initial?.role ?? {});
  const [text, setText] = useState<LocalizedText>(initial?.text ?? {});
  const [avatar, setAvatar] = useState<MediaRef | null>(initial?.avatar ?? null);
  const [rating, setRating] = useState<number | null>(initial?.rating ?? null);
  const [published, setPublished] = useState(initial?.published ?? false);
  const { pending, fieldErrors, run } = useActionSubmit();

  const submit = (): void => {
    run(
      () => saveReview(initial?.id ?? null, { author, role, text, avatarId: avatar?.id ?? null, rating, published }),
      {
        onSuccess: data => {
          if (!initial) router.replace(`/admin/reviews/${data.id}`);
        },
      },
    );
  };

  const authorError = errorFor(fieldErrors, 'author');
  const ratingError = errorFor(fieldErrors, 'rating');

  return (
    <EntityFormShell
      onSubmit={submit}
      pending={pending}
      isNew={initial === null}
      localeGaps={translationGaps([role, text])}
      localeErrors={localesWithErrors(fieldErrors, LOCALIZED)}
      siteLinks={initial ? siteLinksFor('reviews') : undefined}
      remove={initial ? { entity: 'review', id: initial.id, listHref: '/admin/reviews' } : undefined}
      aside={
        <>
          <Card title={t('form.publication')}>
            <Switch checked={published} onCheckedChange={setPublished} label={t('form.showOnSite')} />
          </Card>
          <Card title={t('reviews.form.authorPhoto')}>
            <MediaPicker
              id="review-avatar"
              label={t('reviews.form.avatar')}
              value={avatar}
              onChange={setAvatar}
              error={errorFor(fieldErrors, 'avatarId')}
            />
          </Card>
        </>
      }
    >
      <Card title={t('reviews.form.review')} bodyClassName="flex flex-col gap-5">
        <Field
          htmlFor="review-author"
          label={t('reviews.form.author')}
          required
          error={authorError}
          hint={t('form.sameInAllLanguages')}
        >
          <TextInput
            id="review-author"
            value={author}
            onChange={event => setAuthor(event.target.value)}
            invalid={Boolean(authorError)}
            aria-describedby={describedBy('review-author', true, authorError)}
            aria-required
            maxLength={120}
            placeholder={t('reviews.form.authorPlaceholder')}
          />
        </Field>
        <StarRatingField
          id="review-rating"
          label={t('reviews.form.rating')}
          value={rating}
          max={ratingMax}
          onChange={setRating}
          error={ratingError}
          hint={t.rich('reviews.form.scaleHint', {
            count: ratingMax,
            link: chunks => (
              <Link href="/admin/settings" className="text-beige hover:underline">
                {chunks}
              </Link>
            ),
          })}
        />
        <LocalizedField
          name="role"
          label={t('reviews.form.role')}
          value={role}
          onChange={setRole}
          fieldErrors={fieldErrors}
          maxLength={120}
          placeholder={t('reviews.form.rolePlaceholder')}
        />
        <LocalizedField
          name="text"
          label={t('reviews.form.text')}
          required
          multiline
          rows={6}
          value={text}
          onChange={setText}
          fieldErrors={fieldErrors}
          maxLength={3000}
        />
      </Card>
    </EntityFormShell>
  );
}
