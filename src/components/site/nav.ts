import { SECTION_ANCHORS } from "@/lib/content/anchors";
import type { TextKey } from "@/lib/content/registry";

/**
 * The site menu — the header, the mobile menu and the footer list the same items, in the order
 * of the chapters on the page: Главная, Каталог, О нас, Индивидуальный пошив, Специальное
 * предложение, Контакты. Isomorphic and tiny (type-only import of the registry).
 */
export const NAV: ReadonlyArray<{ key: TextKey; anchor: string }> = [
  { key: "header.nav.home", anchor: SECTION_ANCHORS.hero },
  { key: "header.nav.catalog", anchor: SECTION_ANCHORS.catalog },
  { key: "header.nav.about", anchor: SECTION_ANCHORS.about },
  { key: "header.nav.tailoring", anchor: SECTION_ANCHORS.tailoring },
  { key: "header.nav.offers", anchor: SECTION_ANCHORS.offers },
  { key: "header.nav.contacts", anchor: SECTION_ANCHORS.contacts },
];

/**
 * Section id → highlighted menu item (scroll-spy): every menu section highlights itself. The
 * chapters without a menu item (news, gallery, reviews, partners — between «Специальное
 * предложение» and «Контакты») highlight nothing, so the highlight only ever moves forward
 * through the menu. The red band names the chapter it belongs to (data-nav-section).
 */
export const ACTIVE_MAP: Readonly<Record<string, string | null>> = Object.fromEntries(NAV.map((item) => [item.anchor, item.anchor]));
