import { describe, expect, it } from "vitest";
import type { CollectionView, LandingContent, SettingsView } from "@/lib/content/types";
import { isPlaceholderValue } from "./brand";
import { composeMetadata, composeRootMetadata } from "./compose";
import { breadcrumbJsonLd, collectionPageJsonLd, landingJsonLd, serializeJsonLd } from "./json-ld";
import {
  absoluteUrl,
  isLocalSiteUrl,
  languageAlternates,
  localizedPath,
  localizedUrl,
  normalizeSiteUrl,
  openGraphLocale,
} from "./site-url";

const SITE = "https://gadyuka.ru";

const settings: SettingsView = {
  phone: "+7 (861) 200-00-01",
  email: "hello@gadyuka.ru",
  address: "ул. Красная, 1",
  socials: [
    { type: "telegram", url: "https://t.me/gadyuka_brand" },
    { type: "vk", url: "https://vk.com/" },
  ],
  seoTitle: "ГАДЮКА — авторская уличная одежда",
  seoDescription: "Стритвир с авторскими моделями.",
  ogImage: {
    id: "m1",
    src: "/uploads/seed/og.webp",
    width: 1386,
    height: 780,
    mime: "image/webp",
    alt: "Вордмарк",
    altDefault: "Вордмарк",
  },
};

describe("site URLs", () => {
  it("normalizes SITE_URL to an origin", () => {
    expect(normalizeSiteUrl("https://gadyuka.ru/")).toBe(SITE);
    expect(normalizeSiteUrl("  https://gadyuka.ru/some/path ")).toBe(SITE);
    expect(normalizeSiteUrl(undefined)).toBe("http://localhost:3000");
    expect(normalizeSiteUrl("ftp://x")).toBe("http://localhost:3000");
    expect(normalizeSiteUrl("not a url")).toBe("http://localhost:3000");
  });

  it("builds as-needed localized paths (ru without prefix)", () => {
    expect(localizedPath("ru", "/")).toBe("/");
    expect(localizedPath("en", "/")).toBe("/en");
    expect(localizedPath("ru", "/catalog/menya-zapomnyat")).toBe("/catalog/menya-zapomnyat");
    expect(localizedPath("en", "catalog/menya-zapomnyat/")).toBe("/en/catalog/menya-zapomnyat");
  });

  it("builds absolute URLs and hreflang alternates", () => {
    expect(absoluteUrl("/", SITE)).toBe(SITE);
    expect(absoluteUrl("/uploads/a.webp", SITE)).toBe(`${SITE}/uploads/a.webp`);
    expect(absoluteUrl("https://cdn.example/x.png", SITE)).toBe("https://cdn.example/x.png");
    expect(localizedUrl("en", "/", SITE)).toBe(`${SITE}/en`);
    expect(languageAlternates("/", SITE)).toEqual({ ru: SITE, en: `${SITE}/en`, "x-default": SITE });
  });

  it("knows local origins and OG locales", () => {
    expect(isLocalSiteUrl("http://localhost:3000")).toBe(true);
    expect(isLocalSiteUrl(SITE)).toBe(false);
    expect(openGraphLocale("ru")).toBe("ru_RU");
    expect(openGraphLocale("en")).toBe("en_US");
  });
});

describe("composeMetadata", () => {
  it("sets canonical, hreflang (ru/en/x-default), OG and Twitter for the landing", () => {
    const metadata = composeMetadata("en", settings, { path: "/" }, SITE);
    expect(metadata.title).toEqual({ absolute: settings.seoTitle });
    expect(metadata.description).toBe(settings.seoDescription);
    expect(metadata.alternates).toEqual({
      canonical: `${SITE}/en`,
      languages: { ru: SITE, en: `${SITE}/en`, "x-default": SITE },
    });
    expect(metadata.openGraph).toMatchObject({
      url: `${SITE}/en`,
      siteName: "GADYUKA",
      locale: "en_US",
      alternateLocale: ["ru_RU"],
      images: [{ url: `${SITE}/uploads/seed/og.webp`, width: 1386, height: 780, alt: "Вордмарк", type: "image/webp" }],
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image", images: [`${SITE}/uploads/seed/og.webp`] });
    expect(metadata.robots).toEqual({ index: true, follow: true });
  });

  it("falls back to the generated OG image and the brand name", () => {
    const metadata = composeMetadata("ru", { seoTitle: "", seoDescription: "", ogImage: null }, { path: "/" }, SITE);
    expect(metadata.title).toEqual({ absolute: "ГАДЮКА" });
    expect(metadata.description).toBeUndefined();
    expect(metadata.openGraph?.images).toEqual([
      { url: `${SITE}/opengraph-image.png`, width: 1200, height: 630, alt: "ГАДЮКА", type: "image/png" },
    ]);
  });

  it("supports page titles, custom images and noindex", () => {
    const metadata = composeMetadata(
      "ru",
      settings,
      { path: "/catalog/menya-zapomnyat", title: "Меня запомнят", image: null, noIndex: true },
      SITE,
    );
    expect(metadata.title).toEqual({ absolute: "Меня запомнят — ГАДЮКА" });
    expect(metadata.alternates?.canonical).toBe(`${SITE}/catalog/menya-zapomnyat`);
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("writes the brand in Latin on the English site (titles, og:site_name)", () => {
    const metadata = composeMetadata("en", settings, { path: "/catalog/menya-zapomnyat", title: "They Will Remember Me" }, SITE);
    expect(metadata.title).toEqual({ absolute: "They Will Remember Me — GADYUKA" });
    expect(metadata.openGraph).toMatchObject({ siteName: "GADYUKA" });
    const fallback = composeMetadata("en", { seoTitle: "", seoDescription: "", ogImage: null }, { path: "/" }, SITE);
    expect(fallback.title).toEqual({ absolute: "GADYUKA" });
    const root = composeRootMetadata("en", settings, SITE);
    expect(root.title).toEqual({ default: settings.seoTitle, template: "%s — GADYUKA" });
    expect(root.applicationName).toBe("GADYUKA");
    expect(composeRootMetadata("ru", settings, SITE).applicationName).toBe("ГАДЮКА");
  });

  it("never indexes local origins; root metadata has no canonical", () => {
    expect(composeMetadata("ru", settings, { path: "/" }, "http://localhost:3000").robots).toEqual({
      index: false,
      follow: false,
    });
    const root = composeRootMetadata("ru", settings, SITE);
    expect(root.alternates).toBeUndefined();
    expect(root.metadataBase?.toString()).toBe(`${SITE}/`);
    expect(root.title).toEqual({ default: settings.seoTitle, template: "%s — ГАДЮКА" });
  });
});

describe("JSON-LD", () => {
  it("escapes script-breaking characters", () => {
    const json = serializeJsonLd({ name: "</script><script>alert(1)</script> & \u2028" });
    expect(json).not.toContain("</script>");
    expect(json).toContain("\\u003c/script\\u003e");
    expect(json).toContain("\\u0026");
    expect(json).toContain("\\u2028");
    expect(JSON.parse(json)).toEqual({ name: "</script><script>alert(1)</script> & \u2028" });
  });

  it("detects placeholder contacts", () => {
    expect(isPlaceholderValue("+7 (000) 000-00-00")).toBe(true);
    expect(isPlaceholderValue("hello@example.com")).toBe(true);
    expect(isPlaceholderValue("Краснодар (адрес — заглушка, укажите в админке)")).toBe(true);
    expect(isPlaceholderValue("+7 (861) 200-00-01")).toBe(false);
    expect(isPlaceholderValue("hello@gadyuka.ru")).toBe(false);
  });

  const collection: CollectionView = {
    id: "c1",
    slug: "menya-zapomnyat",
    title: "Меня запомнят",
    description: "Худи с тату-графикой",
    cover: null,
    products: [
      {
        id: "p1",
        slug: "hoodie-white-logo",
        title: "Худи «Логотип»",
        description: "",
        details: [],
        price: 6900,
        images: [{ id: "i1", src: "/uploads/seed/hoodie.webp", width: 960, height: 720, mime: "image/webp", alt: "", altDefault: "" }],
      },
      {
        id: "p2",
        slug: "hoodie-scales",
        title: "Худи «Чешуя»",
        description: "Чешуя",
        details: [],
        price: null,
        images: [],
      },
    ],
  };

  function landing(overrides: Partial<LandingContent> = {}): LandingContent {
    return {
      locale: "ru",
      texts: { "hero.slogan": "Меня запомнят" } as LandingContent["texts"],
      images: {} as LandingContent["images"],
      collections: [collection],
      reviews: [],
      news: [],
      gallery: [],
      offers: [],
      partners: [],
      settings,
      year: 2026,
      ...overrides,
    };
  }

  it("describes the brand as a ClothingStore in Krasnodar with products", () => {
    const data = landingJsonLd(landing(), SITE);
    expect(data["@context"]).toBe("https://schema.org");
    const graph = data["@graph"];
    expect(Array.isArray(graph)).toBe(true);
    const json = JSON.parse(serializeJsonLd(data)) as { "@graph": Array<Record<string, unknown>> };
    const [store, website, list] = json["@graph"];
    expect(store).toMatchObject({
      "@type": "ClothingStore",
      name: "ГАДЮКА",
      url: SITE,
      logo: { url: `${SITE}/icon.png` },
      telephone: "+7 (861) 200-00-01",
      address: { addressLocality: "Краснодар", addressCountry: "RU", streetAddress: "ул. Красная, 1" },
      sameAs: ["https://t.me/gadyuka_brand"],
    });
    expect(website).toMatchObject({
      "@type": "WebSite",
      name: "ГАДЮКА",
      alternateName: ["GADYUKA"],
      inLanguage: "ru-RU",
      publisher: { "@id": `${SITE}/#organization` },
    });
    const collectionUrl = `${SITE}/catalog/${collection.slug}`;
    expect(list).toMatchObject({ "@type": "ItemList", name: "Меня запомнят", numberOfItems: 2, url: collectionUrl });
    const items = (list?.itemListElement ?? []) as Array<Record<string, unknown> & { item?: Record<string, unknown> }>;
    expect(items[0]?.item).toMatchObject({
      "@type": "Product",
      name: "Худи «Логотип»",
      description: "Худи с тату-графикой",
      image: [`${SITE}/uploads/seed/hoodie.webp`],
      brand: { "@type": "Brand", name: "ГАДЮКА" },
      url: `${collectionUrl}#product-${collection.products[0]?.slug}`,
      offers: { "@type": "Offer", price: 6900, priceCurrency: "RUB" },
    });
    // Price on request: no Product without offers (invalid for Google) — a summary ListItem instead.
    expect(items[1]).toEqual({
      "@type": "ListItem",
      position: 2,
      name: "Худи «Чешуя»",
      url: `${collectionUrl}#product-${collection.products[1]?.slug}`,
    });
    // every product has its own URL
    expect(new Set(items.map((entry) => entry.url ?? entry.item?.url)).size).toBe(2);
  });

  it("collection page: breadcrumbs and an ItemList with the page URL", () => {
    const content = landing({
      locale: "en",
      texts: { "hero.slogan": "", "header.nav.home": "Home", "header.nav.catalog": "Catalog" } as LandingContent["texts"],
    });
    const json = JSON.parse(serializeJsonLd(collectionPageJsonLd(content, collection, SITE))) as {
      "@graph": Array<Record<string, unknown>>;
    };
    const [, breadcrumbs, list] = json["@graph"];
    const pageUrl = `${SITE}/en/catalog/${collection.slug}`;
    expect(breadcrumbs).toEqual({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/en` },
        { "@type": "ListItem", position: 2, name: "Меня запомнят", item: pageUrl },
      ],
    });
    expect(list).toMatchObject({ "@type": "ItemList", url: pageUrl, "@id": `${pageUrl}#items` });
  });

  it("drops placeholder contacts and empty collections", () => {
    const data = landingJsonLd(
      landing({
        locale: "en",
        collections: [{ ...collection, products: [] }],
        settings: {
          ...settings,
          phone: "+7 (000) 000-00-00",
          email: "hello@example.com",
          address: "Krasnodar (placeholder address)",
        },
      }),
      SITE,
    );
    const json = JSON.parse(serializeJsonLd(data)) as { "@graph": Array<Record<string, unknown>> };
    expect(json["@graph"]).toHaveLength(2);
    // the English site is named in Latin (the SEO title is never the site name)
    expect(json["@graph"][1]).toMatchObject({ "@type": "WebSite", name: "GADYUKA", alternateName: ["ГАДЮКА"] });
    const store = json["@graph"][0];
    expect(store?.telephone).toBeUndefined();
    expect(store?.email).toBeUndefined();
    expect(store?.url).toBe(`${SITE}/en`);
    expect(store?.address).toEqual({ "@type": "PostalAddress", addressLocality: "Krasnodar", addressCountry: "RU" });
  });

  it("builds a BreadcrumbList", () => {
    expect(
      breadcrumbJsonLd([
        { name: "Главная", url: SITE },
        { name: "Меня запомнят", url: `${SITE}/catalog/menya-zapomnyat` },
      ]),
    ).toEqual({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Главная", item: SITE },
        { "@type": "ListItem", position: 2, name: "Меня запомнят", item: `${SITE}/catalog/menya-zapomnyat` },
      ],
    });
  });
});
