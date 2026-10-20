import { localeNames, locales } from '@/i18n/locales';
import type { LandingContent } from '@/lib/content';
import { LEAD_FORM_ANCHOR, SECTION_ANCHORS } from '@/lib/content';
import { localizedPath } from '@/lib/seo/site-url';

import type { ReactElement } from 'react';

import { HeaderClient, type NavItem } from './chrome/HeaderClient';
import { ScrollSpine } from './chrome/ScrollSpine';
import { splitLanguageTemplate, type LanguageSwitcherProps } from './labels';
import { activeMapFor, menuLink } from './nav';

/**
 * Skip link, reading-progress snake and the fixed header (menu + language switcher + mobile
 * menu). The menu is the published MenuItem rows flagged «в шапке» (LandingContent.menu).
 * `homePath`: on pages other than the landing (a collection page) the menu anchors point to
 * the landing sections ("/#about", "/en#about"); on the landing they stay "#about".
 * `path`: the page without its locale prefix ("/", "/catalog/<slug>") — the language switcher
 * links to it in the other languages. All copy is resolved here (no next-intl on the client).
 */
export function SiteHeader({
  content,
  homePath = '',
  path = '/',
}: {
  content: LandingContent;
  homePath?: string;
  path?: string;
}): ReactElement {
  const { texts, locale } = content;
  const headerMenu = content.menu.filter(item => item.showInHeader);
  const nav: NavItem[] = headerMenu.map(item => menuLink(item, homePath, locale));
  const { before, after } = splitLanguageTemplate(texts['common.switchLanguageTo']);
  const languages: LanguageSwitcherProps = {
    label: texts['common.languageSwitcher'],
    switchBefore: before,
    switchAfter: after,
    // The language names are each language's own name (endonym) — the same on every page, so
    // they are locale configuration (src/i18n/locales.ts), not per-language messages.
    options: locales.map(option => ({
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
        {texts['common.skipToContent']}
      </a>
      <ScrollSpine />
      <HeaderClient
        nav={nav}
        homeHref={homePath ? homePath : `#${SECTION_ANCHORS.hero}`}
        formHref={`${homePath}#${LEAD_FORM_ANCHOR}`}
        menuCaption={texts['header.menuCaption']}
        cta={texts['header.cta']}
        activeMap={activeMapFor(headerMenu)}
        labels={{
          homeLink: texts['common.homeLink'],
          mainNavigation: texts['common.mainNavigation'],
          openMenu: texts['common.openMenu'],
          closeMenu: texts['common.closeMenu'],
          mobileMenu: texts['common.mobileMenu'],
          opensInNewTab: texts['common.opensInNewTab'],
        }}
        languages={languages}
      />
    </>
  );
}
