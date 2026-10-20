import type { Locale } from '@/i18n/locales';
import type { Messages } from '@/i18n/request';

/**
 * Site messages for the public CLIENT components. They are resolved on the server (DB rows over
 * the messages/*.json defaults — LandingContent.texts / getMessages) and passed down as props,
 * so the public pages ship no next-intl client runtime and no message catalogue. Templates are
 * filled in here with the tiny helpers below (simple {name} placeholders only — the server
 * components use ./message-template, full ICU). Isomorphic and dependency-free.
 *
 * A message filled in by these helpers must be registry kind "template"
 * (src/lib/content/registry.ts): the admin then only accepts what they render exactly like ICU —
 * literal text, bare {name} placeholders and the default's tags as written there, each once
 * (validateMessageValue, syntax "template"; message-template.test.ts checks the equivalence).
 */

export type FormMessages = Messages['forms'];

/** Accessible names in the header and the mobile menu. */
export type HeaderLabels = {
  homeLink: string;
  mainNavigation: string;
  openMenu: string;
  closeMenu: string;
  mobileMenu: string;
  /** Hidden hint after a menu link that opens in a new tab («(откроется в новой вкладке)»). */
  opensInNewTab: string;
};

/** The image viewer of the gallery. */
export type GalleryLabels = {
  imageViewer: string;
  previousImage: string;
  nextImage: string;
  closeViewer: string;
  /** gallery.counter: «{current} / {total}» (kind "template", see fill()). */
  counter: string;
};

/** One language of the switcher; hrefs are the same page in that language (computed on the server). */
export type LanguageOption = {
  locale: Locale;
  short: string;
  /** The language's own name ("English"), marked up in that language. */
  native: string;
  href: string;
  current: boolean;
};

export type LanguageSwitcherProps = {
  /** aria-label of the switcher's <nav>. */
  label: string;
  options: ReadonlyArray<LanguageOption>;
  /** "Переключить язык на " — the text around the language's name in a link's hidden label. */
  switchBefore: string;
  switchAfter: string;
};

/** Fills the {name} placeholders of a "template" message («Минимум {min} символа», «{current} / {total}»). */
export function fill(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (match: string, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}

/**
 * The text before and after one placeholder of a "template" message (it occurs at most once),
 * for wrapping the inserted part in markup:
 * ("По поводу: {subject}", "{subject}") → { before: "По поводу: ", after: "" }.
 * A template without the placeholder is all `before` (the inserted part then goes last).
 */
export function splitTemplate(template: string, placeholder: string): { before: string; after: string } {
  const at = template.indexOf(placeholder);
  if (at === -1) return { before: template, after: '' };
  return { before: template.slice(0, at), after: template.slice(at + placeholder.length) };
}

/** "Switch language to <lang>{language}</lang>" → the text before and after the language's name. */
export function splitLanguageTemplate(template: string): { before: string; after: string } {
  return splitTemplate(template, '<lang>{language}</lang>');
}
