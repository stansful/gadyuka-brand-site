/**
 * How the admin edits a site text and how the site uses it (shared/contracts/site-texts.ts SiteTextKind):
 * - TEXT: one line of plain text;
 * - RICHTEXT: plain text with paragraphs separated by an empty line (no HTML);
 * - ICU: an ICU template the server fills in (next-intl t(): {arguments}, plural forms, <tags>);
 * - TEMPLATE: a simple template the public CLIENT components fill in without an ICU runtime (bare
 *   {arguments} and the default's <tags>, each once — no plural forms or formats);
 * - LINK: a URL or an in-page anchor.
 */
export enum SiteTextKind {
  TEXT = 'text',
  RICHTEXT = 'richtext',
  ICU = 'icu',
  TEMPLATE = 'template',
  LINK = 'link',
}
