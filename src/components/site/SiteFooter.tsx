import { getTranslations } from "next-intl/server";
import type { ReactElement } from "react";
import type { LandingContent } from "@/lib/content";
import { SECTION_ANCHORS } from "@/lib/content";
import { FooterScene } from "./scenes/FooterScene";
import { NAV } from "./nav";

/** «Конец выпуска. Продолжение следует…», the big wordmark, © + year, the menu and «Наверх». */
export async function SiteFooter({ content, homePath = "" }: { content: LandingContent; homePath?: string }): Promise<ReactElement> {
  const t = await getTranslations("common");
  const { texts, year } = content;
  return (
    <FooterScene className="ftr">
      <div className="wrap">
        {texts["footer.end"] ? (
          <p className="ftr__end caption caption--paper" data-edit="footer.end">
            {texts["footer.end"]}
          </p>
        ) : null}
        {texts["footer.tbc"] ? (
          <p className="ftr__tbc" data-edit="footer.tbc">
            {texts["footer.tbc"]}
          </p>
        ) : null}
        <span className="ftr__word mask-img m-wordmark" aria-hidden="true" />
        <div className="ftr__row">
          <div className="ftr__legal">
            <p className="ftr__copy">
              <span data-edit="footer.copyright">{texts["footer.copyright"]}</span> {year}
            </p>
            {texts["footer.trademark"] ? (
              <p className="ftr__tm">
                <span className="ftr__tm-mark" aria-hidden="true">
                  ®
                </span>
                <span data-edit="footer.trademark">{texts["footer.trademark"]}</span>
              </p>
            ) : null}
          </div>
          <nav className="ftr__nav" aria-label={t("footerNavigation")}>
            {NAV.map((item) => (
              <a key={item.key} href={`${homePath}#${item.anchor}`} data-edit={item.key}>
                {texts[item.key]}
              </a>
            ))}
          </nav>
          <a className="ftr__top" href={homePath ? "#main" : `#${SECTION_ANCHORS.hero}`}>
            <span data-edit="footer.top">{texts["footer.top"]}</span> <span aria-hidden="true">↑</span>
          </a>
        </div>
      </div>
    </FooterScene>
  );
}
