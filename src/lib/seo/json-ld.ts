import { localeTags, type Locale } from "@/i18n/locales";
import type { CollectionView, LandingContent, SettingsView } from "@/lib/content/types";
import { BRAND, BRAND_LOGO, brandName, isPlaceholderValue } from "./brand";
import { shareImage } from "./compose";
import { absoluteUrl, collectionPath, getSiteUrl, localizedUrl } from "./site-url";

/**
 * schema.org JSON-LD builders (pure, isomorphic). Render with <JsonLd data={…} />
 * (src/lib/seo/JsonLd.tsx), which escapes the payload for a <script> tag.
 */

export type JsonLdValue = string | number | boolean | null | JsonLdObject | ReadonlyArray<JsonLdValue>;
export type JsonLdObject = { readonly [key: string]: JsonLdValue | undefined };

const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

/** JSON for <script type="application/ld+json">: `<`, `>`, `&`, U+2028/2029 are escaped. */
export function serializeJsonLd(data: JsonLdObject): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .split(LINE_SEPARATOR)
    .join("\\u2028")
    .split(PARAGRAPH_SEPARATOR)
    .join("\\u2029");
}

export function organizationId(siteUrl: string): string {
  return `${siteUrl}/#organization`;
}

export function websiteId(siteUrl: string): string {
  return `${siteUrl}/#website`;
}

/** Social profile URLs with a real path (bare "https://t.me/" placeholders are skipped). */
function sameAsUrls(settings: SettingsView): string[] {
  const out: string[] = [];
  for (const social of settings.socials) {
    try {
      const url = new URL(social.url);
      if (url.pathname.replace(/\/+$/, "").length > 0 && !out.includes(url.href)) out.push(url.href);
    } catch {
      // ignore malformed URLs
    }
  }
  return out;
}

export type OrganizationInput = {
  locale: Locale;
  settings: SettingsView;
  siteUrl?: string;
  slogan?: string;
};

/** ClothingStore (a schema.org Organization / LocalBusiness) for the brand. */
export function organizationJsonLd({
  locale,
  settings,
  siteUrl = getSiteUrl(),
  slogan,
}: OrganizationInput): JsonLdObject {
  const address = settings.address && !isPlaceholderValue(settings.address) ? settings.address : undefined;
  const sameAs = sameAsUrls(settings);
  return {
    "@type": "ClothingStore",
    "@id": organizationId(siteUrl),
    name: BRAND.name,
    alternateName: BRAND.alternateName,
    url: localizedUrl(locale, "/", siteUrl),
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl(BRAND_LOGO.path, siteUrl),
      width: BRAND_LOGO.width,
      height: BRAND_LOGO.height,
    },
    image: shareImage(settings.ogImage, BRAND.name, siteUrl).url,
    description: settings.seoDescription || undefined,
    slogan: slogan || BRAND.slogan[locale],
    telephone: settings.phone && !isPlaceholderValue(settings.phone) ? settings.phone : undefined,
    email: settings.email && !isPlaceholderValue(settings.email) ? settings.email : undefined,
    address: {
      "@type": "PostalAddress",
      addressLocality: BRAND.city[locale],
      addressCountry: BRAND.countryCode,
      streetAddress: address,
    },
    currenciesAccepted: BRAND.currency,
    sameAs: sameAs.length > 0 ? sameAs : undefined,
  };
}

/**
 * WebSite — `name` is what search engines show as the site name, so it is the brand as written
 * in this language («ГАДЮКА» / «GADYUKA»), never the SEO page title; the other spellings of the
 * brand are its alternate names.
 */
export function websiteJsonLd({
  locale,
  description,
  siteUrl = getSiteUrl(),
}: {
  locale: Locale;
  description?: string;
  siteUrl?: string;
}): JsonLdObject {
  const name = brandName(locale);
  const alternates = [BRAND.name, BRAND.alternateName].filter((other) => other !== name);
  return {
    "@type": "WebSite",
    "@id": websiteId(siteUrl),
    url: localizedUrl(locale, "/", siteUrl),
    name,
    alternateName: alternates.length > 0 ? alternates : undefined,
    description: description || undefined,
    inLanguage: localeTags[locale],
    publisher: { "@id": organizationId(siteUrl) },
  };
}

/** URL of a product card: the collection page + the card's fragment (#product-<slug>). */
export function productUrl(collectionUrl: string, productSlug: string): string {
  return `${collectionUrl}#product-${productSlug}`;
}

/**
 * ItemList of a collection's products, pointing at the collection page.
 *
 * Google requires a Product to carry `offers`, `review` or `aggregateRating`, and «цена по
 * запросу» products have none of them — so only products WITH a price are emitted as
 * Product (with an Offer); price-on-request products are plain summary ListItems
 * ({ position, name, url }), which is valid for an ItemList and never reported as an
 * invalid Product.
 */
export function collectionItemListJsonLd({
  collection,
  collectionUrl,
  siteUrl = getSiteUrl(),
}: {
  collection: CollectionView;
  /** Absolute URL of the collection page in the current locale. */
  collectionUrl: string;
  siteUrl?: string;
}): JsonLdObject | null {
  if (collection.products.length === 0) return null;
  return {
    "@type": "ItemList",
    "@id": `${collectionUrl}#items`,
    url: collectionUrl,
    name: collection.title,
    description: collection.description || undefined,
    numberOfItems: collection.products.length,
    itemListElement: collection.products.map((product, index): JsonLdObject => {
      const url = productUrl(collectionUrl, product.slug);
      if (product.price === null) {
        return { "@type": "ListItem", position: index + 1, name: product.title, url };
      }
      return {
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "Product",
          "@id": url,
          name: product.title,
          description: product.description || collection.description || undefined,
          sku: product.slug,
          image: product.images.length > 0 ? product.images.map((image) => absoluteUrl(image.src, siteUrl)) : undefined,
          brand: { "@type": "Brand", name: BRAND.name },
          category: collection.title,
          url,
          offers: {
            "@type": "Offer",
            price: product.price,
            priceCurrency: BRAND.currency,
            availability: "https://schema.org/InStock",
            itemCondition: "https://schema.org/NewCondition",
            url,
            seller: { "@id": organizationId(siteUrl) },
          },
        },
      };
    }),
  };
}

export type BreadcrumbItem = { name: string; url: string };

/** BreadcrumbList, e.g. [Главная → Каталог → «Меня запомнят»] on a collection page. */
export function breadcrumbJsonLd(items: ReadonlyArray<BreadcrumbItem>): JsonLdObject {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** Wrap entities into one document: { "@context", "@graph": [...] }. */
export function jsonLdGraph(entities: ReadonlyArray<JsonLdObject | null>): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@graph": entities.filter((entity): entity is JsonLdObject => entity !== null),
  };
}

/** Landing page graph: ClothingStore + WebSite + an ItemList per collection (→ collection pages). */
export function landingJsonLd(content: LandingContent, siteUrl: string = getSiteUrl()): JsonLdObject {
  const { locale, settings } = content;
  return jsonLdGraph([
    organizationJsonLd({ locale, settings, siteUrl, slogan: content.texts["hero.slogan"] }),
    websiteJsonLd({ locale, description: settings.seoDescription, siteUrl }),
    ...content.collections.map((collection) =>
      collectionItemListJsonLd({
        collection,
        collectionUrl: localizedUrl(locale, collectionPath(collection.slug), siteUrl),
        siteUrl,
      }),
    ),
  ]);
}

/**
 * Collection page graph: ClothingStore + BreadcrumbList (Главная → коллекция) + ItemList.
 * The visual breadcrumbs also show «Каталог», but it is a section of the home page (/#catalog):
 * crawlers drop the fragment, so as a crumb it would repeat the home URL.
 */
export function collectionPageJsonLd(
  content: LandingContent,
  collection: CollectionView,
  siteUrl: string = getSiteUrl(),
): JsonLdObject {
  const { locale, settings, texts } = content;
  const homeUrl = localizedUrl(locale, "/", siteUrl);
  const collectionUrl = localizedUrl(locale, collectionPath(collection.slug), siteUrl);
  return jsonLdGraph([
    organizationJsonLd({ locale, settings, siteUrl, slogan: texts["hero.slogan"] }),
    breadcrumbJsonLd([
      { name: texts["header.nav.home"] || brandName(locale), url: homeUrl },
      { name: collection.title, url: collectionUrl },
    ]),
    collectionItemListJsonLd({ collection, collectionUrl, siteUrl }),
  ]);
}
