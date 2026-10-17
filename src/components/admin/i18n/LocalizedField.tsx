"use client";

import type { ReactElement, ReactNode } from "react";
import { defaultLocale, localeNames, type Locale } from "@/i18n/locales";
import type { FieldErrors } from "@/lib/admin/action-result";
import type { LocalizedText } from "@/lib/i18n-text";
import { describedBy, Field } from "../ui/Field";
import { TextArea, TextInput } from "../ui/inputs";
import { useEditLocale } from "./LocaleTabs";

export type LocalizedFieldProps = {
  /** Field name in the submitted object (used for error lookup: "title", "title.en"). */
  name: string;
  label: ReactNode;
  value: LocalizedText;
  onChange: (next: LocalizedText) => void;
  multiline?: boolean;
  rows?: number;
  /** The default locale (ru) must be filled in; other locales stay optional. */
  required?: boolean;
  hint?: ReactNode;
  fieldErrors?: FieldErrors;
  maxLength?: number;
  placeholder?: string;
  /** Prefix for the input id (several forms on one page). */
  idPrefix?: string;
};

function errorForLocale(fieldErrors: FieldErrors | undefined, name: string, locale: Locale): string | undefined {
  if (!fieldErrors) return undefined;
  const own = fieldErrors[`${name}.${locale}`];
  if (own) return own;
  return locale === defaultLocale ? fieldErrors[name] : undefined;
}

/** One translatable field: shows the input of the language selected in <LocaleTabs>. */
export function LocalizedField({
  name,
  label,
  value,
  onChange,
  multiline = false,
  rows = 4,
  required = false,
  hint,
  fieldErrors,
  maxLength,
  placeholder,
  idPrefix = "f",
}: LocalizedFieldProps): ReactElement {
  const { locale } = useEditLocale();
  const id = `${idPrefix}-${name.replace(/[^A-Za-z0-9_-]/g, "-")}-${locale}`;
  const text = value[locale] ?? "";
  const fallback = value[defaultLocale] ?? "";
  const isDefault = locale === defaultLocale;
  const error = errorForLocale(fieldErrors, name, locale);

  let effectiveHint: ReactNode = hint;
  if (!isDefault && text.trim() === "" && fallback.trim() !== "") {
    const preview = fallback.length > 90 ? `${fallback.slice(0, 90)}…` : fallback;
    effectiveHint = (
      <>
        Нет перевода — на сайте будет показан русский текст: «{preview}»{hint ? <> · {hint}</> : null}
      </>
    );
  }

  const handleChange = (next: string): void => {
    onChange({ ...value, [locale]: next });
  };

  const commonProps = {
    id,
    value: text,
    maxLength,
    placeholder,
    invalid: Boolean(error),
    lang: locale,
    "aria-describedby": describedBy(id, effectiveHint, error),
    "aria-required": (required && isDefault) || undefined,
  };

  return (
    <Field
      htmlFor={id}
      label={label}
      required={required && isDefault}
      hint={effectiveHint}
      error={error}
      aside={
        <span className="rounded bg-raised-hi px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-muted" title={localeNames[locale].ru}>
          {localeNames[locale].short}
        </span>
      }
    >
      {multiline ? (
        <TextArea {...commonProps} rows={rows} onChange={(event) => handleChange(event.target.value)} />
      ) : (
        <TextInput {...commonProps} type="text" onChange={(event) => handleChange(event.target.value)} />
      )}
    </Field>
  );
}
