/**
 * How the site fills a message in:
 * - ICU: next-intl t() / formatText (plural, select, number and date formats);
 * - TEMPLATE: the public client components (no ICU runtime) — a plain search-and-replace of
 *   "{name}" and of the default's tags ("<lang>{language}</lang>").
 */
export enum MessageSyntax {
  ICU = 'icu',
  TEMPLATE = 'template',
}
