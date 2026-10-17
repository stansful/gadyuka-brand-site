import type { Locale } from "@/i18n/locales";
import type { Messages } from "@/i18n/request";

/**
 * System copy (messages/*.json) for the public client components. It is resolved on the server
 * (getTranslations / getMessages) and passed down as props, so the public pages ship no
 * next-intl client runtime and no message catalogue. Isomorphic and dependency-free.
 */

export type CommonMessages = Messages["common"];
export type FormMessages = Messages["forms"];

/** Accessible names in the header and the mobile menu. */
export type HeaderLabels = Pick<CommonMessages, "homeLink" | "mainNavigation" | "openMenu" | "closeMenu" | "mobileMenu">;

/** The image viewer of the gallery; `galleryPhoto` is a template ("Фото {number}", see fill()). */
export type GalleryLabels = Pick<CommonMessages, "imageViewer" | "previousImage" | "nextImage" | "closeViewer" | "galleryPhoto">;

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

/** Fills the {name} placeholders of a plain message ("Минимум {min} символа"). */
export function fill(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (match: string, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}

/** "Switch language to <lang>{language}</lang>" → the text before and after the language's name. */
export function splitLanguageTemplate(template: string): { before: string; after: string } {
  const [before = "", after = ""] = template.split("<lang>{language}</lang>");
  return { before, after };
}
