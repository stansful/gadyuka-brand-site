import type { LandingContent } from '@/lib/content';
import { SECTION_ANCHORS } from '@/lib/content';

import type { ReactElement } from 'react';

import { formatText } from './message-template';
import { menuLink } from './nav';
import { FooterScene } from './scenes/FooterScene';

/**
 * «Конец выпуска. Продолжение следует…», the big wordmark, the copyright line (footer.copyright,
 * «© ГАДЮКА {year}»), the menu (MenuItem rows flagged «в подвале») and «Наверх».
 */
export function SiteFooter({ content, homePath = '' }: { content: LandingContent; homePath?: string }): ReactElement {
  const { texts, year, locale } = content;
  const menu = content.menu.filter(item => item.showInFooter).map(item => menuLink(item, homePath, locale));
  return (
    <FooterScene className="ftr">
      <div className="wrap">
        {texts['footer.end'] ? (
          <p className="ftr__end caption caption--paper" data-edit="footer.end">
            {texts['footer.end']}
          </p>
        ) : null}
        {texts['footer.tbc'] ? (
          <p className="ftr__tbc" data-edit="footer.tbc">
            {texts['footer.tbc']}
          </p>
        ) : null}
        <span className="ftr__word mask-img m-wordmark" aria-hidden="true" />
        <div className="ftr__row">
          <div className="ftr__legal">
            <p className="ftr__copy">
              <span data-edit="footer.copyright">
                {formatText(texts['footer.copyright'], locale, { year: String(year) })}
              </span>
            </p>
            {texts['footer.trademark'] ? (
              <p className="ftr__tm">
                <span className="ftr__tm-mark" aria-hidden="true">
                  ®
                </span>
                <span data-edit="footer.trademark">{texts['footer.trademark']}</span>
              </p>
            ) : null}
          </div>
          <nav className="ftr__nav" aria-label={texts['common.footerNavigation']}>
            {menu.map(item =>
              item.external ? (
                <a
                  key={item.id}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-entity="MenuItem"
                  data-entity-id={item.id}
                >
                  {item.label}
                  {texts['common.opensInNewTab'] ? (
                    <span className="sr-only"> {texts['common.opensInNewTab']}</span>
                  ) : null}
                </a>
              ) : (
                <a key={item.id} href={item.href} data-entity="MenuItem" data-entity-id={item.id}>
                  {item.label}
                </a>
              ),
            )}
          </nav>
          <a className="ftr__top" href={homePath ? '#main' : `#${SECTION_ANCHORS.hero}`}>
            <span data-edit="footer.top">{texts['footer.top']}</span> <span aria-hidden="true">↑</span>
          </a>
        </div>
      </div>
    </FooterScene>
  );
}
