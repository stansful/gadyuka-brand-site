/**
 * A link the admin puts on the site (offer buttons, menu items, "link" site texts): absolute http(s),
 * site-relative "/…" (never "//host"), an in-page anchor "#…", mailto: or tel: — never javascript: or
 * data:.
 */
export class SiteHref {
  static readonly MAX_LENGTH = 500;

  static readonly PATTERN = /^(https?:\/\/[^\s]+|\/(?!\/)[^\s]*|#[A-Za-z0-9_-]*|mailto:[^\s]+|tel:[+0-9()\s-]+)$/;

  /** "#" alone is a valid link but points nowhere: a menu item needs the section after it. */
  static readonly BARE_HASH = '#';

  /** Checks the trimmed value (the length too). */
  static isValid(value: string): boolean {
    const text = value.trim();
    return text.length <= SiteHref.MAX_LENGTH && SiteHref.PATTERN.test(text);
  }
}
