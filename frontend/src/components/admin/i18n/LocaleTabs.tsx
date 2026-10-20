'use client';

import { clsx } from 'clsx';
import { useTranslations } from 'next-intl';
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

import { defaultLocale, localeNames, locales, type Locale } from '@/i18n/locales';
import type { FieldErrors } from '@/lib/admin/action-result';
import type { LocalizedText } from '@/lib/i18n-text';

/**
 * Language tabs of an admin form. Generated from `locales` (src/i18n/locales.ts),
 * so a new language shows up here automatically. All LocalizedField inputs inside
 * the same provider follow the selected tab.
 */

type LocaleContextValue = { locale: Locale; setLocale: (locale: Locale) => void };

const EditLocaleContext = createContext<LocaleContextValue | null>(null);

export function EditLocaleProvider({ children }: { children: ReactNode }): ReactElement {
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const value = useMemo(() => ({ locale, setLocale }), [locale]);
  return <EditLocaleContext value={value}>{children}</EditLocaleContext>;
}

export function useEditLocale(): LocaleContextValue {
  const value = useContext(EditLocaleContext);
  if (!value) throw new Error('useEditLocale must be used inside <EditLocaleProvider>');
  return value;
}

/** Per locale: how many of `texts` are filled in the default locale but empty in this one. */
export function translationGaps(texts: ReadonlyArray<LocalizedText>): Partial<Record<Locale, number>> {
  const gaps: Partial<Record<Locale, number>> = {};
  for (const locale of locales) {
    if (locale === defaultLocale) continue;
    const count = texts.filter(text => (text[defaultLocale] ?? '').trim() && !(text[locale] ?? '').trim()).length;
    if (count > 0) gaps[locale] = count;
  }
  return gaps;
}

/**
 * After a failed save: when the visible language tab has no errors but another one does,
 * switch to the first tab with errors (otherwise the error messages exist only in a hidden
 * tab and nothing tells a screen-reader user where to look). Runs once per new error set.
 */
export function useFocusLocaleWithErrors(errors: Set<Locale> | undefined): void {
  const { locale: current, setLocale } = useEditLocale();
  const errorLocales = locales.filter(locale => errors?.has(locale) ?? false);
  const errorKey = errorLocales.join(',');
  const firstWithError = errorLocales[0];
  const currentHasError = errors?.has(current) ?? false;
  const handledKey = useRef('');
  useEffect(() => {
    if (errorKey === handledKey.current) return;
    handledKey.current = errorKey;
    if (firstWithError && !currentHasError) setLocale(firstWithError);
  }, [errorKey, firstWithError, currentHasError, setLocale]);
}

/** Locales that have a field error ("title.en" → en; "title" → default locale). */
export function localesWithErrors(fieldErrors: FieldErrors, localizedFields: readonly string[]): Set<Locale> {
  const result = new Set<Locale>();
  for (const key of Object.keys(fieldErrors)) {
    const [field, maybeLocale] = key.split('.');
    if (!field || !localizedFields.includes(field)) continue;
    const match = locales.find(locale => locale === maybeLocale);
    result.add(match ?? defaultLocale);
  }
  return result;
}

export function LocaleTabs({
  gaps = {},
  errors,
  className,
}: {
  gaps?: Partial<Record<Locale, number>>;
  errors?: Set<Locale>;
  className?: string;
}): ReactElement {
  const t = useTranslations('admin.form.languages');
  const { locale: current, setLocale } = useEditLocale();
  const labelId = useId();
  return (
    <div className={clsx('flex flex-wrap items-center gap-3', className)}>
      <span className="text-xs font-medium text-muted" id={labelId}>
        {t('label')}
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        className="inline-flex rounded-lg border border-line-strong bg-panel p-0.5"
      >
        {locales.map(locale => {
          const selected = locale === current;
          const gap = gaps[locale] ?? 0;
          const hasError = errors?.has(locale) ?? false;
          return (
            <button
              key={locale}
              type="button"
              aria-pressed={selected}
              onClick={() => setLocale(locale)}
              title={
                locale === defaultLocale
                  ? t('primaryTitle', { language: localeNames[locale].ru })
                  : localeNames[locale].ru
              }
              className={clsx(
                'relative inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold tracking-wider transition-colors',
                selected ? 'bg-blue text-fg' : 'text-muted hover:text-fg',
              )}
            >
              {localeNames[locale].short}
              {locale === defaultLocale ? (
                <span className="font-normal tracking-normal text-muted">{t('primary')}</span>
              ) : null}
              {/* The state is spoken as text (aria-label on a plain <span> is ignored by screen readers). */}
              {hasError ? (
                <>
                  <span className="size-2 rounded-full bg-red-fg" aria-hidden />
                  <span className="sr-only">{t('hasErrors')}</span>
                </>
              ) : gap > 0 ? (
                <>
                  <span className="rounded-full bg-beige/20 px-1.5 text-[10px] text-beige" aria-hidden>
                    {gap}
                  </span>
                  <span className="sr-only">{t('untranslated', { count: gap })}</span>
                </>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
