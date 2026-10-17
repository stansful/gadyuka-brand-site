import type { ReactElement } from "react";
import type { LandingContent, NewsView } from "@/lib/content";
import { SECTION_ANCHORS, chapterNumber } from "@/lib/content";
import { ContentImage } from "../ContentImage";
import { formatMonthYear, formatShortDate } from "../format";
import { aspectOf, coverSizes, newsColumns, newsPictureSlots } from "../layout-rules";
import { RichText } from "../RichText";
import { NewsScene } from "../scenes/NewsScene";
import { ChapterLabel, EmptyState, Folio } from "./parts";

/** Minimum length of one ticker copy, so the marquee never shows a gap on wide screens. */
const TICKER_MIN_CHARS = 160;

/** «Срочно: заголовок ✦ заголовок ✦ …», repeated until long enough. */
function tickerText(label: string, news: ReadonlyArray<NewsView>): string {
  const titles = news.map((item) => item.title).filter(Boolean);
  if (titles.length === 0) return "";
  const once = `${titles.join(" ✦ ")} ✦`;
  let text = label ? `${label} ${once}` : once;
  while (text.length < TICKER_MIN_CHARS) text = `${text} ${label ? `${label} ` : ""}${once}`;
  return text;
}

/** Глава 05 · Новости и события — a newspaper page: masthead, a ticker of the headlines, columns of stories. */
export function NewsSection({ content }: { content: LandingContent }): ReactElement {
  const { texts, news, locale, year } = content;
  const newest = news[0];
  const dateline = newest ? formatMonthYear(newest.date, locale) : String(year);
  const ticker = tickerText(texts["news.tickerLabel"], news);
  const columns = newsColumns(news.length);

  return (
    <NewsScene id={SECTION_ANCHORS.news} className="page page--paper" labelledBy="news-title" folio={chapterNumber("news")}>
      <div className="wrap">
        <div className="gazette" data-wipe="down">
          <header className="gazette__mast">
            <p className="gazette__top">
              <span data-edit="news.edition">{texts["news.edition"]}</span>
              <span data-edit="news.city">{texts["news.city"]}</span>
              <span>{dateline}</span>
            </p>
            <p className="gazette__kicker">
              <ChapterLabel chapter="news" texts={texts} suffixKey="news.kicker" />
            </p>
            <h2 className="gazette__title" id="news-title" data-edit="news.title" data-text={texts["news.title"]}>
              {texts["news.title"]}
            </h2>
          </header>

          {ticker ? (
            <div className="ticker" aria-hidden="true">
              <div className="ticker__track">
                <span className="ticker__item">{ticker}</span>
                <span className="ticker__item">{ticker}</span>
              </div>
            </div>
          ) : null}

          {news.length > 0 ? (
            <div className={`gazette__cols gazette__cols--${columns}`}>
              {news.map((item, index) => {
                const lead = index === 0;
                const image = item.image ? (
                  <div className={lead ? "story__img media halftone noir" : "story__img story__img--small media halftone noir"}>
                    <ContentImage
                      image={item.image}
                      sizes={coverSizes(aspectOf(item.image), newsPictureSlots(columns, lead))}
                      fallbackAlt={item.title}
                    />
                  </div>
                ) : null;
                return (
                  <article
                    key={item.id}
                    id={`news-${item.slug}`}
                    className={lead ? "story story--lead" : "story"}
                    data-entity="NewsItem"
                    data-entity-id={item.id}
                  >
                    {lead ? image : null}
                    <p className="story__date">
                      <time dateTime={item.date} data-field="date">
                        {formatShortDate(item.date, locale)}
                      </time>
                    </p>
                    <h3 className="story__title" data-field="title">
                      {item.title}
                    </h3>
                    <RichText text={item.excerpt} field="excerpt" className="story__text" />
                    {item.body ? (
                      <details className="story__more">
                        <summary className="link-btn link-btn--paper">
                          <span data-edit="news.readMore">{texts["news.readMore"]}</span> <span className="glyph" aria-hidden="true">→</span>
                        </summary>
                        <RichText text={item.body} className="story__body" />
                      </details>
                    ) : null}
                    {lead ? null : image}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="gazette__cols gazette__cols--1">
              <EmptyState text={texts["news.text"]} editKey="news.text" />
            </div>
          )}
        </div>
      </div>
      <Folio chapter="news" paper />
    </NewsScene>
  );
}
