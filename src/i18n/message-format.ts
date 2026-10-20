import {
  isArgumentElement,
  isDateElement,
  isLiteralElement,
  isNumberElement,
  isPluralElement,
  isSelectElement,
  isTagElement,
  isTimeElement,
  parse,
  type DateElement,
  type MessageFormatElement,
  type NumberElement,
  type TimeElement,
} from '@formatjs/icu-messageformat-parser';
import { IntlMessageFormat, type FormatXMLElementFn, type PrimitiveType } from 'intl-messageformat';

import { defaultLocale, localeTags, locales, type Locale } from './locales';
import { defaultMessage, type MessageKey } from './messages';

/**
 * ICU MessageFormat checks for admin-edited site messages (ISOMORPHIC: the admin editor can
 * validate as the user types, the Server Action validates again before saving).
 *
 * A value must render the way the site reads its key, and may only use the arguments and tags
 * of its default:
 * - plain copy rendered as-is (texts["hero.title"]) is parsed by nobody; its default has no
 *   {arguments} or <tags>, so a value may not have any either;
 * - full ICU — next-intl t(), formatText / formatNodes (src/components/site/message-template):
 *   plural, select, number and date formats. next-intl parses and formats the message at
 *   render time, so a value is also trial-formatted here: a format that throws (a bad number
 *   skeleton or currency, a date format of a text argument) would show the key instead;
 * - simple templates (syntax "template" = registry kind "template"): filled in by the public
 *   CLIENT components, which ship no ICU runtime — fill() / splitTemplate() in
 *   src/components/site/labels.ts, a plain search-and-replace of "{name}" and of the default's
 *   tag ("<lang>{language}</lang>"). Only what that replace renders exactly like ICU passes.
 *
 * Parser: @formatjs/icu-messageformat-parser, formatter: intl-messageformat — what next-intl
 * itself uses.
 */

/** Arguments ("count", "min") and rich-text tags ("lang") a message uses. */
export type MessageFormat = {
  readonly arguments: readonly string[];
  readonly tags: readonly string[];
};

export type MessageFormatParse = { ok: true; format: MessageFormat } | { ok: false; error: string };

/** How the site fills a message in: full ICU, or the simple templates of the client components. */
export type MessageSyntax = 'icu' | 'template';

/** Cheap check: does the text contain ICU syntax ({argument}, plural, <tag>)? No parsing. */
export function hasMessageSyntax(value: string): boolean {
  return /[{}]|<\/?[A-Za-z][\w-]*>/.test(value);
}

type ElementsParse = { ok: true; elements: MessageFormatElement[] } | { ok: false; error: string };

/** Parsed with locations: the template checks compare an element with its source text. */
function parseElements(value: string): ElementsParse {
  try {
    return { ok: true, elements: parse(value, { captureLocation: true }) };
  } catch (error: unknown) {
    return { ok: false, error: error instanceof Error ? error.message : 'INVALID_MESSAGE' };
  }
}

/** The source text of a parsed element (parsed with captureLocation). */
function sourceOf(value: string, element: MessageFormatElement): string {
  const location = element.location;
  return location ? value.slice(location.start.offset, location.end.offset) : '';
}

function collect(elements: readonly MessageFormatElement[], args: Set<string>, tags: Set<string>): void {
  for (const element of elements) {
    if (isArgumentElement(element) || isNumberElement(element) || isDateElement(element) || isTimeElement(element)) {
      args.add(element.value);
    } else if (isPluralElement(element) || isSelectElement(element)) {
      args.add(element.value);
      for (const option of Object.values(element.options)) collect(option.value, args, tags);
    } else if (isTagElement(element)) {
      tags.add(element.value);
      collect(element.children, args, tags);
    }
  }
}

function formatOf(elements: readonly MessageFormatElement[]): MessageFormat {
  const args = new Set<string>();
  const tags = new Set<string>();
  collect(elements, args, tags);
  return { arguments: [...args], tags: [...tags] };
}

/**
 * Parses `value` as ICU MessageFormat. `error` is the parser's error kind
 * ("EXPECT_ARGUMENT_CLOSING_BRACE", "UNCLOSED_TAG", …) for the admin to map to a message.
 */
export function parseMessageFormat(value: string): MessageFormatParse {
  const parsed = parseElements(value);
  return parsed.ok ? { ok: true, format: formatOf(parsed.elements) } : parsed;
}

/** Parsed defaults of a key, one per locale (the defaults are valid ICU: registry test). */
function defaultElements(key: MessageKey): MessageFormatElement[][] {
  return locales.flatMap(locale => {
    const parsed = parseElements(defaultMessage(key, locale));
    return parsed.ok ? [parsed.elements] : [];
  });
}

/**
 * Arguments and tags of a key's defaults, merged over every locale — what the code passes to
 * the message (for hints in the editor: "{min} — минимум символов").
 */
export function defaultMessageFormat(key: MessageKey): MessageFormat {
  return formatOf(defaultElements(key).flat());
}

export type MessageValueIssue =
  /** Not valid ICU (unbalanced braces, an unclosed tag …); `error` is the parser's error kind. */
  | { code: 'syntax'; error: string }
  /** `{name}` that the code never passes — next-intl would fail to render the message. */
  | { code: 'unknownArgument'; name: string }
  /** `<name>` that the default does not use — nothing renders it. */
  | { code: 'unknownTag'; name: string }
  /** A tag of the default is missing (the code splits the text on it, e.g. `<lang>`). */
  | { code: 'missingTag'; name: string }
  /** Template: a plural / select / number / date argument — the site inserts the value as it is. */
  | { code: 'templateFormat'; name: string }
  /** Template: `{ name }`, or a tag not written exactly as in the default — the site would not find it. */
  | { code: 'templateToken'; token: string }
  /** Template: an argument or tag used twice — the site inserts each value once. */
  | { code: 'templateRepeat'; token: string }
  /** Template: ICU apostrophe quoting ('' or '{…}') — the site would show the apostrophes. */
  | { code: 'templateQuote' }
  /** Valid ICU that throws when formatted; `token` is its source ("{count, number, ::currency/XY}"). */
  | { code: 'format'; token: string; error: string };

// ── simple templates ────────────────────────────────────────────────────────

/** "<lang>{language}</lang>": the tags of the defaults as written there (what the site splits on). */
function defaultTagSources(key: MessageKey): Map<string, string[]> {
  const sources = new Map<string, string[]>();
  const visit = (value: string, elements: readonly MessageFormatElement[]): void => {
    for (const element of elements) {
      if (!isTagElement(element)) continue;
      const known = sources.get(element.value) ?? [];
      const source = sourceOf(value, element);
      if (!known.includes(source)) sources.set(element.value, [...known, source]);
      visit(value, element.children);
    }
  };
  for (const locale of locales) {
    const value = defaultMessage(key, locale);
    const parsed = parseElements(value);
    if (parsed.ok) visit(value, parsed.elements);
  }
  return sources;
}

/**
 * Template rules: literal text written as it shows (no apostrophe quoting), bare `{name}`
 * arguments and the default's tags written exactly as in the default, each at most once.
 * Such a value reads the same to ICU and to a plain search-and-replace of its tokens.
 */
function templateIssues(
  key: MessageKey,
  value: string,
  elements: readonly MessageFormatElement[],
): MessageValueIssue[] {
  const tagSources = defaultTagSources(key);
  const seen = new Set<string>();
  const issues: MessageValueIssue[] = [];
  const once = (token: string): void => {
    if (seen.has(token)) issues.push({ code: 'templateRepeat', token });
    seen.add(token);
  };
  const visit = (items: readonly MessageFormatElement[]): void => {
    for (const element of items) {
      const source = sourceOf(value, element);
      if (isLiteralElement(element)) {
        if (source !== element.value) issues.push({ code: 'templateQuote' });
      } else if (isArgumentElement(element)) {
        const token = `{${element.value}}`;
        if (source === token) once(token);
        else issues.push({ code: 'templateToken', token });
      } else if (isTagElement(element)) {
        const allowed = tagSources.get(element.value) ?? [];
        if (allowed.includes(source)) {
          once(`<${element.value}>`);
          visit(element.children);
        } else {
          issues.push({ code: 'templateToken', token: allowed[0] ?? `<${element.value}>…</${element.value}>` });
        }
      } else if (
        isPluralElement(element) ||
        isSelectElement(element) ||
        isNumberElement(element) ||
        isDateElement(element) ||
        isTimeElement(element)
      ) {
        issues.push({ code: 'templateFormat', name: element.value });
      }
    }
  };
  visit(elements);
  return issues;
}

// ── trial format ────────────────────────────────────────────────────────────

type SampleValue = PrimitiveType | FormatXMLElementFn<string>;
type ArgumentType = 'number' | 'date' | 'text';

function collectTypes(elements: readonly MessageFormatElement[], types: Map<string, ArgumentType>): void {
  for (const element of elements) {
    if (isNumberElement(element) || isPluralElement(element)) types.set(element.value, 'number');
    else if (isDateElement(element) || isTimeElement(element)) types.set(element.value, 'date');
    if (isPluralElement(element) || isSelectElement(element)) {
      for (const option of Object.values(element.options)) collectTypes(option.value, types);
    } else if (isTagElement(element)) {
      collectTypes(element.children, types);
    }
  }
}

/**
 * A value of the type the code passes for each argument of the key, as its defaults use it:
 * a number for a plural / number argument, a date for a date / time one, else a text (a text
 * may also stand for a number or a React node: neither is formatted as a date).
 */
function sampleValues(key: MessageKey, format: MessageFormat): Record<string, SampleValue> {
  const types = new Map<string, ArgumentType>();
  for (const elements of defaultElements(key)) collectTypes(elements, types);
  const samples: Record<string, SampleValue> = {};
  for (const name of format.arguments) {
    const type = types.get(name) ?? 'text';
    samples[name] = type === 'number' ? 2 : type === 'date' ? new Date(Date.UTC(2026, 0, 31, 12)) : 'x';
  }
  for (const name of format.tags) samples[name] = (chunks: ReadonlyArray<string>) => chunks.join('');
  return samples;
}

type FormattedElement = NumberElement | DateElement | TimeElement;

/** Every number / date / time argument, in every plural and select branch. */
function formattedElements(elements: readonly MessageFormatElement[]): FormattedElement[] {
  return elements.flatMap((element): FormattedElement[] => {
    if (isNumberElement(element) || isDateElement(element) || isTimeElement(element)) return [element];
    if (isPluralElement(element) || isSelectElement(element)) {
      return Object.values(element.options).flatMap(option => formattedElements(option.value));
    }
    return isTagElement(element) ? formattedElements(element.children) : [];
  });
}

function formatError(
  elements: MessageFormatElement[],
  locale: Locale,
  samples: Record<string, SampleValue>,
): string | null {
  try {
    new IntlMessageFormat(elements, localeTags[locale]).format<string>(samples);
    return null;
  } catch (error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * Formats the value as the site would, with sample values: each formatted argument on its own
 * (a branch the samples do not select is checked too), then the whole message.
 */
function formatIssues(
  key: MessageKey,
  value: string,
  elements: MessageFormatElement[],
  locale: Locale,
): MessageValueIssue[] {
  const samples = sampleValues(key, formatOf(elements));
  for (const element of formattedElements(elements)) {
    const error = formatError([element], locale, samples);
    if (error !== null) return [{ code: 'format', token: sourceOf(value, element), error }];
  }
  const error = formatError(elements, locale, samples);
  return error === null ? [] : [{ code: 'format', token: value, error }];
}

// ── validation ──────────────────────────────────────────────────────────────

export type MessageValueOptions = {
  /** "template" for the keys the client components fill in (registry kind "template"). Default "icu". */
  readonly syntax?: MessageSyntax;
  /** Language of the value (plural rules, number formats of the trial format). */
  readonly locale?: Locale;
};

/**
 * Problems of an admin-entered value for `key` ([] = fine). A blank value is fine here —
 * whether a key may be empty is MessageDefinition.required (./registry in src/lib/content).
 * Arguments of the default may be left out (the text just does not show them).
 */
export function validateMessageValue(
  key: MessageKey,
  value: string,
  { syntax = 'icu', locale = defaultLocale }: MessageValueOptions = {},
): MessageValueIssue[] {
  if (value.trim() === '') return [];
  const parsed = parseElements(value);
  if (!parsed.ok) return [{ code: 'syntax', error: parsed.error }];
  const format = formatOf(parsed.elements);
  const allowed = defaultMessageFormat(key);
  const issues: MessageValueIssue[] = [];
  for (const name of format.arguments) {
    if (!allowed.arguments.includes(name)) issues.push({ code: 'unknownArgument', name });
  }
  for (const name of format.tags) {
    if (!allowed.tags.includes(name)) issues.push({ code: 'unknownTag', name });
  }
  for (const name of allowed.tags) {
    if (!format.tags.includes(name)) issues.push({ code: 'missingTag', name });
  }
  if (issues.length > 0) return issues;
  if (syntax === 'template') {
    const template = templateIssues(key, value, parsed.elements);
    if (template.length > 0) return template;
  }
  return formatIssues(key, value, parsed.elements, locale);
}
