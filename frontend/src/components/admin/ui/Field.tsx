import { clsx } from 'clsx';
import { useTranslations } from 'next-intl';

import type { ReactElement, ReactNode } from 'react';

export type FieldProps = {
  /** id of the control inside (label htmlFor). */
  htmlFor: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  /** Small element on the right of the label (e.g. a locale badge). */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
};

/** ids for aria-describedby: `${id}-hint`, `${id}-error`. */
export function describedBy(id: string, hint: unknown, error: unknown): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}

/** Label + control + hint + error, with ids matching describedBy(). Server and client. */
export function Field({ htmlFor, label, hint, error, required, aside, className, children }: FieldProps): ReactElement {
  const t = useTranslations('admin.ui');
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-sm font-medium text-fg/90">
          {label}
          {required ? (
            <span className="ml-0.5 text-beige" aria-hidden>
              *
            </span>
          ) : null}
          {required ? <span className="sr-only"> {t('requiredMark')}</span> : null}
        </label>
        {aside}
      </div>
      {children}
      {hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs leading-relaxed text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs font-medium text-red-fg" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
