import { getMessages } from "next-intl/server";
import type { ReactElement } from "react";
import { localeNames, locales } from "@/i18n/locales";
import type { LandingContent, TextKey } from "@/lib/content";
import { LEAD_FORM_ANCHOR, SECTION_ANCHORS } from "@/lib/content";
import { localizedPath } from "@/lib/seo/site-url";
import { HeaderClient, type NavItem } from "./chrome/HeaderClient";
import { splitLanguageTemplate, type LanguageSwitcherProps } from "./labels";
import { ScrollSpine } from "./chrome/ScrollSpine";

/** Main menu (same order as the chapters on the page): Главная, Каталог, О нас, Индивидуальный пошив, Контакты. */
export const NAV: ReadonlyArray<{ key: TextKey; anchor: string }> = [
  { key: "header.nav.home", anchor: SECTION_ANCHORS.hero },
  { key: "header.nav.catalog", anchor: SECTION_ANCHORS.catalog },
  { key: "header.nav.about", anchor: SECTION_ANCHORS.about },
  { key: "header.nav.tailoring", anchor: SECTION_ANCHORS.tailoring },
  { key: "header.nav.contacts", anchor: SECTION_ANCHORS.contacts },
];

/**
 * Section id → highlighted menu item. Chapters between «Индивидуальный пошив» and «Контакты»
 * (reviews, news, gallery, offers, partners) have no menu item, so nothing is highlighted
 * there — the highlight only ever moves forward through the menu.
 */
const ACTIVE_MAP: Readonly<Record<string, string | null>> = {
  [SECTION_ANCHORS.hero]: SECTION_ANCHORS.hero,
  [SECTION_ANCHORS.catalog]: SECTION_ANCHORS.catalog,
  [SECTION_ANCHORS.about]: SECTION_ANCHORS.about,
  [SECTION_ANCHORS.tailoring]: SECTION_ANCHORS.tailoring,
  [SECTION_ANCHORS.contacts]: SECTION_ANCHORS.contacts,
};

/**
 * Skip link, reading-progress snake and the fixed header (menu + language switcher + mobile
 * menu). `homePath`: on pages other than the landing (a collection page) the menu anchors
 * point to the landing sections ("/#about", "/en#about"); on the landing they stay "#about".
 * `path`: the page without its locale prefix ("/", "/catalog/<slug>") — the language switcher
 * links to it in the other languages. All copy is resolved here (no next-intl on the client).
 */
export async function SiteHeader({ content, homePath = "", path = "/" }: { content: LandingContent; homePath?: string; path?: string }): Promise<ReactElement> {
  const { common } = await getMessages();
  const { texts, locale } = content;
  const nav: NavItem[] = NAV.map((item) => ({
    anchor: item.anchor,
    href: `${homePath}#${item.anchor}`,
    label: texts[item.key],
    editKey: item.key,
  }));
  const { before, after } = splitLanguageTemplate(common.switchLanguageTo);
  const languages: LanguageSwitcherProps = {
    label: common.languageSwitcher,
    switchBefore: before,
    switchAfter: after,
    options: locales.map((option) => ({
      locale: option,
      short: localeNames[option].short,
      native: localeNames[option].native,
      href: localizedPath(option, path),
      current: option === locale,
    })),
  };
  return (
    <>
      <a className="skip" href="#main">
        {common.skipToContent}
      </a>
      <ScrollSpine />
      <HeaderClient
        nav={nav}
        homeHref={homePath ? homePath : `#${SECTION_ANCHORS.hero}`}
        formHref={`${homePath}#${LEAD_FORM_ANCHOR}`}
        menuCaption={texts["header.menuCaption"]}
        cta={texts["header.cta"]}
        activeMap={ACTIVE_MAP}
        labels={{
          homeLink: common.homeLink,
          mainNavigation: common.mainNavigation,
          openMenu: common.openMenu,
          closeMenu: common.closeMenu,
          mobileMenu: common.mobileMenu,
        }}
        languages={languages}
      />
    </>
  );
}
