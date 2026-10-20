import { IntlMessageFormat } from 'intl-messageformat';
import { Fragment, type ReactNode } from 'react';

import { localeTags, type Locale } from '@/i18n/locales';

/**
 * Site message templates rendered by the SERVER components (do not import from a client
 * component: it would ship the ICU runtime): «Глава {number}», "{chapter} · {label}",
 * "#{number}", "© ГАДЮКА {year}" … — DB-backed messages (LandingContent.texts) whose arguments
 * the code fills in. The owner edits the whole template in the admin, so word order,
 * punctuation and quotes follow the language instead of being glued together in code.
 *
 * Unlike next-intl's t(), an argument may be a React node — <span data-edit="…">, <time> —
 * so the markup (and its edit hooks) around a part survives. Full ICU (plural, select,
 * number) via intl-messageformat, the formatter next-intl itself uses.
 *
 * Never throws: admin edits are validated before saving (validateMessageValue: only the
 * arguments of the default, and a trial format), and a value that still cannot be formatted
 * (a row edited by hand, an argument the code does not pass) renders as its raw text instead
 * of failing the page.
 * A plain {argument} is inserted as it is (String() — a year stays «2026»); pass zero-padded
 * numbers as strings ("02").
 */

type Values<T> = Readonly<Record<string, string | number | T>>;

/** Parsed templates, per locale (a few dozen in practice; bounded anyway). */
const formats = new Map<string, IntlMessageFormat>();
const MAX_CACHED_FORMATS = 500;

function formatFor(template: string, locale: Locale): IntlMessageFormat {
  const cacheKey = `${locale}\u0000${template}`;
  let format = formats.get(cacheKey);
  if (!format) {
    format = new IntlMessageFormat(template, localeTags[locale]);
    if (formats.size >= MAX_CACHED_FORMATS) formats.clear();
    formats.set(cacheKey, format);
  }
  return format;
}

function partsOf<T>(template: string, locale: Locale, values: Values<T>): Array<string | T> {
  try {
    // Literal parts carry the text, object parts the React nodes.
    return formatFor(template, locale)
      .formatToParts<T>({ ...values })
      .map(part => part.value);
  } catch (error: unknown) {
    if (process.env.NODE_ENV !== 'production') console.warn(`[messages] cannot format «${template}»:`, error);
    return [template];
  }
}

/** A template with string / number values → plain text (attributes, alt texts, subjects). */
export function formatText(template: string, locale: Locale, values: Values<never>): string {
  return partsOf(template, locale, values).join('');
}

/**
 * A template whose values may be React nodes → renderable children:
 * formatNodes("{chapter} · {label}", locale, { chapter: <span …>Глава 02</span>, label: … }).
 */
export function formatNodes(template: string, locale: Locale, values: Values<ReactNode>): ReactNode {
  const parts = partsOf<ReactNode>(template, locale, values);
  if (parts.every(part => typeof part === 'string')) return parts.join('');
  return parts.map((part, index) => <Fragment key={index}>{part}</Fragment>);
}
