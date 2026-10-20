'use client';

import { clsx } from 'clsx';
import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, type ReactElement, type ReactNode } from 'react';

import { describedBy } from '../ui/Field';

/**
 * Star rating picker: 1..`max` stars + «Без оценки». Built on native radio buttons inside a
 * <fieldset>, so it is a real radio group for screen readers and works with the keyboard as
 * expected (Tab focuses the group, arrow keys change the rating, Space selects).
 */
export function StarRatingField({
  id,
  label,
  value,
  max,
  onChange,
  hint,
  error,
}: {
  id: string;
  label: ReactNode;
  value: number | null;
  /** Stars of the scale (SiteSettings.reviewRatingMax). */
  max: number;
  onChange: (next: number | null) => void;
  hint?: ReactNode;
  error?: string;
}): ReactElement {
  const t = useTranslations('admin.reviews.stars');
  const name = useId();
  const stars = Array.from({ length: max }, (_, index) => index + 1);
  const shown = value ?? 0;
  const outOfScale = value !== null && value > max;
  const status = value === null ? t('none') : outOfScale ? t('aboveScale', { value }) : t('value', { value, max });

  return (
    <fieldset id={id} className="flex flex-col gap-1.5" aria-describedby={describedBy(id, hint, error)}>
      <legend className="mb-1.5 text-sm font-medium text-fg/90">{label}</legend>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center">
          {stars.map(star => (
            <label
              key={star}
              className="cursor-pointer rounded-md p-0.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-beige"
            >
              <input
                type="radio"
                name={name}
                value={star}
                checked={value === star}
                onChange={() => onChange(star)}
                className="sr-only"
              />
              <Star
                aria-hidden
                className={clsx(
                  'size-6 transition-colors',
                  star <= shown ? 'fill-beige text-beige' : 'text-muted/60 hover:text-beige',
                )}
              />
              <span className="sr-only">{t('value', { value: star, max })}</span>
            </label>
          ))}
        </div>
        <label
          className={clsx(
            'cursor-pointer rounded-md border px-2.5 py-1 text-xs transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-beige',
            value === null ? 'border-beige/60 text-fg' : 'border-line-strong text-muted hover:text-fg',
          )}
        >
          <input
            type="radio"
            name={name}
            value=""
            checked={value === null}
            onChange={() => onChange(null)}
            className="sr-only"
          />
          {t('none')}
        </label>
        <span className="text-xs text-muted" aria-hidden>
          {status}
        </span>
      </div>
      {outOfScale ? <p className="text-xs text-beige">{t('outOfScale', { value, max })}</p> : null}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs leading-relaxed text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-red-fg" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
