import type { Locale } from '@/i18n/locales';
import type { MenuItemView } from '@/lib/content/types';

import { localizeSiteHref } from './lead-links';

/**
 * The site menu comes from MenuItem rows (LandingContent.menu, edited in the admin; the seed
 * creates the owner's six items in page order: Главная, Каталог, О нас, Индивидуальный пошив,
 * Специальное предложение, Контакты). These helpers turn a stored href into a link of the
 * current page and build the scroll-spy map. Isomorphic and tiny.
 */

/** Landing anchor of a menu href ("#catalog" → "catalog"); null for paths and external links. */
export function menuAnchor(href: string): string | null {
  return href.startsWith('#') && href.length > 1 ? href.slice(1) : null;
}

/** An http(s) link to another site — opened in a new tab (with the opensInNewTab hint). */
export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href.trim());
}

/**
 * The href of a menu item on the current page: landing anchors get `homePath` in front
 * ("#about" on the landing, "/en#about" on a collection page), site paths are localized
 * ("/catalog/x" → "/en/catalog/x", a typed language prefix is replaced, query and hash kept),
 * external links / mailto: / tel: are used as is.
 */
export function menuHref(item: Pick<MenuItemView, 'href'>, homePath: string, locale: Locale): string {
  const href = item.href.trim();
  if (menuAnchor(href) !== null) return `${homePath}${href}`;
  return localizeSiteHref(href, locale);
}

/** A menu item as a link of the current page (shared by the header, the mobile menu and the footer). */
export type MenuLink = {
  id: string;
  label: string;
  href: string;
  /** Landing anchor ("catalog") — the key of the scroll-spy highlight; null for other links. */
  anchor: string | null;
  /** External http(s) link: target="_blank" rel="noopener noreferrer" + the hidden hint. */
  external: boolean;
};

export function menuLink(item: MenuItemView, homePath: string, locale: Locale): MenuLink {
  return {
    id: item.id,
    label: item.label,
    href: menuHref(item, homePath, locale),
    anchor: menuAnchor(item.href.trim()),
    external: isExternalHref(item.href),
  };
}

/**
 * Section id → highlighted menu item (scroll-spy): every section linked from the menu
 * highlights itself. The chapters without a menu item (news, gallery, reviews, partners —
 * between «Специальное предложение» and «Контакты» in the seed menu) highlight nothing, so the
 * highlight only ever moves forward through the menu.
 */
export function activeMapFor(
  items: ReadonlyArray<Pick<MenuItemView, 'href'>>,
): Readonly<Record<string, string | null>> {
  return Object.fromEntries(
    items.flatMap(item => {
      const anchor = menuAnchor(item.href.trim());
      return anchor === null ? [] : [[anchor, anchor]];
    }),
  );
}
