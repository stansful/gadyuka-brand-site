import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactElement } from "react";
import { toLocale } from "@/i18n/locales";
import { getCollectionBySlug, getLanding, getPublishedCollectionSlugs, SECTION_ANCHORS } from "@/lib/content";
import { JsonLd } from "@/lib/seo/JsonLd";
import { collectionPageJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata, notFoundMetadata } from "@/lib/seo/metadata";
import { collectionPath, localizedPath } from "@/lib/seo/site-url";
import { CollectionProducts } from "@/components/site/CollectionProducts";
import { ContentImage } from "@/components/site/ContentImage";
import { PICTURE_SLOTS, aspectOf, coverSizes } from "@/components/site/layout-rules";
import { RichText } from "@/components/site/RichText";
import { CatalogScene } from "@/components/site/scenes/CatalogScene";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";

/**
 * Collection page (/catalog/<slug>, /en/catalog/<slug>): the indexable URL of a collection
 * and its products (canonical + hreflang, BreadcrumbList + ItemList JSON-LD, sitemap.xml).
 * Same «Нуар-комикс» language as the landing: a chapter opening with breadcrumbs, the
 * collection panel with its cover, then the products as covers with description and details.
 * Menu anchors and «Заказать» lead back to the landing (the form opens with the product as
 * the subject).
 */

/**
 * Collection pages are reached by full document navigations (plain <a> links from the landing,
 * the sitemap, search engines) and are prerendered per slug, so the page may block on its
 * `slug` param: opt out of the dev-time instant-navigation validation for this segment.
 */
export const instant = false;

/** Never a real slug (slugs are lowercase latin + digits + "-"); keeps the build valid on an empty DB. */
const PLACEHOLDER_SLUG = "__none__";

// Published collections are prerendered; new ones render on first request and are cached.
// Cache Components requires at least one param, hence the placeholder (→ 404) on an empty DB.
export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const slugs = await getPublishedCollectionSlugs();
  return (slugs.length > 0 ? slugs : [PLACEHOLDER_SLUG]).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/catalog/[slug]">): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = toLocale(rawLocale);
  const collection = await getCollectionBySlug(locale, slug);
  if (!collection) return notFoundMetadata(locale);
  return buildMetadata(locale, {
    path: collectionPath(collection.slug),
    title: collection.title,
    description: collection.description || undefined,
    image: collection.cover ?? undefined,
  });
}

export default async function CollectionPage({ params }: PageProps<"/[locale]/catalog/[slug]">): Promise<ReactElement> {
  const { locale: rawLocale, slug } = await params;
  const locale = toLocale(rawLocale);
  const [content, collection, t, tCatalog] = await Promise.all([
    getLanding(locale),
    getCollectionBySlug(locale, slug),
    getTranslations({ locale, namespace: "common" }),
    getTranslations({ locale, namespace: "catalog" }),
  ]);
  if (!collection) notFound();

  const homePath = localizedPath(locale, "/");
  const { texts } = content;

  return (
    <>
      <SiteHeader content={content} homePath={homePath} path={collectionPath(collection.slug)} />
      <main id="main" tabIndex={-1}>
        <CatalogScene
          as="article"
          className="page page--collection"
          id={`collection-${collection.slug}`}
          labelledBy="collection-title"
        >
          <div className="wrap" data-entity="Collection" data-entity-id={collection.id}>
            <header className="chapter">
              <span className="chapter__sheet" aria-hidden="true" />
              <nav className="chapter__no crumbs" aria-label={t("breadcrumbs")}>
                <ol>
                  <li>
                    <a href={homePath} data-edit="header.nav.home">
                      {texts["header.nav.home"]}
                    </a>
                  </li>
                  <li>
                    <a href={`${homePath}#${SECTION_ANCHORS.catalog}`} data-edit="header.nav.catalog">
                      {texts["header.nav.catalog"]}
                    </a>
                  </li>
                  <li>
                    <span aria-current="page">{collection.title}</span>
                  </li>
                </ol>
              </nav>
              <h1 className="chapter__title" id="collection-title" data-field="title" data-text={`«${collection.title}»`}>
                «{collection.title}»
              </h1>
              {texts["catalog.narration"] ? (
                <p className="caption caption--paper chapter__cap" data-edit="catalog.narration">
                  {texts["catalog.narration"]}
                </p>
              ) : null}
            </header>

            <div className="grid grid--intro">
              {/* The first viewport's panels are wiped in by CSS from the first paint
                  (data-wipe-now = their order; noir.css), not by the scene after hydration. */}
              <div className="panel panel--blue series-card scales collection-intro" data-wipe="left" data-wipe-now="0">
                <p className="series-card__kicker">
                  <span data-edit="catalog.seriesLabel">{texts["catalog.seriesLabel"]}</span> ·{" "}
                  {tCatalog("models", { count: collection.products.length })}
                </p>
                <RichText text={collection.description} className="lead" />
              </div>
              <figure className="panel panel--media collection-cover" data-wipe="diag" data-wipe-now="1">
                <div className="media halftone noir">
                  {/* In the first viewport on desktop (likely the LCP): preloaded, not lazy. */}
                  <ContentImage
                    image={collection.cover}
                    sizes={coverSizes(aspectOf(collection.cover), PICTURE_SLOTS.collectionCover)}
                    fallbackAlt={collection.title}
                    priority
                  />
                </div>
              </figure>
            </div>

            <CollectionProducts
              collection={collection}
              texts={texts}
              locale={locale}
              homePath={homePath}
              productHeading="h2"
              withSoon
              detailed
            />
          </div>
        </CatalogScene>
      </main>
      <SiteFooter content={content} homePath={homePath} />
      <JsonLd data={collectionPageJsonLd(content, collection)} />
    </>
  );
}
