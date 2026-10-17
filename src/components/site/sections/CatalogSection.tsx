import { getTranslations } from "next-intl/server";
import type { ReactElement } from "react";
import type { CollectionView, LandingContent } from "@/lib/content";
import { SECTION_ANCHORS, chapterNumber } from "@/lib/content";
import { collectionPath, localizedPath } from "@/lib/seo/site-url";
import { CollectionProducts } from "../CollectionProducts";
import { RichText } from "../RichText";
import { CatalogScene } from "../scenes/CatalogScene";
import { ChapterHeader, Folio } from "./parts";

/**
 * Глава 01 · Каталог: intro panel + the series card of the current collection (tabs for every
 * published collection and «Новые коллекции — скоро»), then each collection's products as
 * comic covers. Collection titles link to their own, indexable pages (/catalog/<slug>).
 */
export async function CatalogSection({ content }: { content: LandingContent }): Promise<ReactElement> {
  const { texts, collections, locale } = content;
  const t = await getTranslations("catalog");
  const tCommon = await getTranslations("common");
  const [current, ...others] = collections;
  const pageOf = (collection: CollectionView): string => localizedPath(locale, collectionPath(collection.slug));
  const kicker = (collection: CollectionView): ReactElement => (
    <>
      <span data-edit="catalog.seriesLabel">{texts["catalog.seriesLabel"]}</span> · {t("models", { count: collection.products.length })}
    </>
  );

  return (
    <CatalogScene id={SECTION_ANCHORS.catalog} className="page" labelledBy="catalog-title" folio={chapterNumber("catalog")}>
      <div className="wrap">
        <ChapterHeader chapter="catalog" texts={texts} titleKey="catalog.title" narrationKey="catalog.narration" headingId="catalog-title" />

        <div className="grid grid--intro">
          <div className={current ? "panel panel--ink intro" : "panel panel--ink intro intro--full"} data-wipe="left">
            {texts["catalog.subtitle"] ? (
              <h3 className="intro__title" data-edit="catalog.subtitle">
                {texts["catalog.subtitle"]}
              </h3>
            ) : null}
            <RichText text={texts["catalog.text"]} editKey="catalog.text" className="lead" />
          </div>

          {current ? (
            <div
              className="panel panel--blue series-card scales"
              data-wipe="down"
              id={`collection-${current.slug}`}
              data-entity="Collection"
              data-entity-id={current.id}
            >
              <p className="series-card__kicker">{kicker(current)}</p>
              <h3 className="series-card__title" data-field="title">
                <a href={pageOf(current)}>«{current.title}»</a>
              </h3>
              <RichText text={current.description} field="description" className="series-card__meta" />
              <ul className="series-tabs" aria-label={tCommon("collections")}>
                <li>
                  <span className="series-tabs__tab is-active" aria-current="true">
                    {current.title}
                  </span>
                </li>
                {others.map((collection) => (
                  <li key={collection.id}>
                    <a className="series-tabs__tab" href={pageOf(collection)}>
                      {collection.title}
                    </a>
                  </li>
                ))}
                <li>
                  <span className="series-tabs__tab is-soon" data-edit="catalog.soonTab">
                    {texts["catalog.soonTab"]}
                  </span>
                </li>
              </ul>
              <a className="series-card__more" href={pageOf(current)}>
                <span data-edit="catalog.openCollection">{texts["catalog.openCollection"]}</span> <span className="glyph" aria-hidden="true">→</span>
              </a>
            </div>
          ) : null}
        </div>

        {current ? (
          <CollectionProducts
            collection={current}
            texts={texts}
            locale={locale}
            homePath=""
            productHeading="h4"
            withSoon={others.length === 0}
          />
        ) : (
          <CollectionProducts
            collection={{ id: "none", slug: "none", title: "", description: "", cover: null, products: [] }}
            texts={texts}
            locale={locale}
            homePath=""
            productHeading="h4"
            withSoon
          />
        )}

        {others.map((collection, index) => (
          <section
            key={collection.id}
            className="series"
            id={`collection-${collection.slug}`}
            aria-labelledby={`collection-${collection.slug}-title`}
            data-entity="Collection"
            data-entity-id={collection.id}
          >
            <header className="series__head">
              <p className="series__kicker">{kicker(collection)}</p>
              <h3 className="series__title" id={`collection-${collection.slug}-title`} data-field="title">
                <a href={pageOf(collection)}>«{collection.title}»</a>
              </h3>
            </header>
            <CollectionProducts
              collection={collection}
              texts={texts}
              locale={locale}
              homePath=""
              productHeading="h4"
              withSoon={index === others.length - 1}
            />
          </section>
        ))}
      </div>
      <Folio chapter="catalog" />
    </CatalogScene>
  );
}
