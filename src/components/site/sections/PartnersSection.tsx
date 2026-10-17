import { getTranslations } from "next-intl/server";
import type { ReactElement } from "react";
import type { LandingContent } from "@/lib/content";
import { SECTION_ANCHORS, chapterNumber } from "@/lib/content";
import { ContentImage } from "../ContentImage";
import { partnerPlaceholderCount } from "../layout-rules";
import { leadLinkProps } from "../lead-links";
import { RichText } from "../RichText";
import { PartnersScene } from "../scenes/PartnersScene";
import { ChapterHeader, Folio } from "./parts";

/**
 * Глава 08 · Партнёры: the «Гадюка × ваш бренд» crossover panel with the partnership CTA (form,
 * topic «Сотрудничество») and a grid of partner slots; free slots tease «Место для партнёра».
 */
export async function PartnersSection({ content }: { content: LandingContent }): Promise<ReactElement> {
  const { texts, partners } = content;
  const t = await getTranslations("common");
  const placeholders = partnerPlaceholderCount(partners.length);
  return (
    <PartnersScene id={SECTION_ANCHORS.partners} className="page" labelledBy="partners-title" folio={chapterNumber("partners")}>
      <div className="wrap">
        <ChapterHeader chapter="partners" texts={texts} titleKey="partners.title" narrationKey="partners.narration" headingId="partners-title" />

        <div className="grid grid--partners">
          <div className="panel panel--ink crossover dots" data-wipe="left">
            <p className="crossover__kicker" data-edit="partners.crossoverKicker">
              {texts["partners.crossoverKicker"]}
            </p>
            <p className="crossover__title">
              <span data-edit="partners.crossoverLeft">{texts["partners.crossoverLeft"]}</span> <i aria-hidden="true">×</i>{" "}
              <span data-edit="partners.crossoverRight">{texts["partners.crossoverRight"]}</span>
            </p>
            <RichText text={texts["partners.text"]} editKey="partners.text" className="lead" />
            <a className="btn btn--red" {...leadLinkProps({ type: "PARTNERSHIP", subject: "" }, "")}>
              <span className="btn__face" data-edit="partners.cta">
                {texts["partners.cta"]}
              </span>
            </a>
          </div>

          <ul className="slots">
            {partners.map((partner) => (
              <li key={partner.id} className="slot slot--partner panel panel--ink" data-wipe="up" data-entity="Partner" data-entity-id={partner.id}>
                {partner.logo ? (
                  <span className="slot__logo slot__logo--img">
                    <ContentImage image={partner.logo} sizes="160px" fallbackAlt={partner.name} />
                  </span>
                ) : (
                  <span className="slot__logo slot__logo--initial" aria-hidden="true">
                    {partner.name.trim().charAt(0).toLocaleUpperCase()}
                  </span>
                )}
                {partner.url ? (
                  <a className="slot__name" href={partner.url} target="_blank" rel="noopener noreferrer" data-field="name">
                    {partner.name}
                    <span className="sr-only"> ({t("opensInNewTab")})</span>
                  </a>
                ) : (
                  <span className="slot__name" data-field="name">
                    {partner.name}
                  </span>
                )}
                {partner.description ? (
                  <p className="slot__desc" data-field="description">
                    {partner.description}
                  </p>
                ) : null}
              </li>
            ))}
            {Array.from({ length: placeholders }, (_, index) => (
              <li key={`free-${index}`} className="slot panel panel--ink" data-wipe="up">
                <span className="slot__logo" aria-hidden="true">
                  ?
                </span>
                <span className="slot__name" data-edit="partners.slotPlaceholder">
                  {texts["partners.slotPlaceholder"]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <Folio chapter="partners" />
    </PartnersScene>
  );
}
