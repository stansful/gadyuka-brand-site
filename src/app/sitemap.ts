import type { MetadataRoute } from "next";
import { locales } from "@/i18n/locales";
import { getSitemapData } from "@/lib/seo/sitemap-data";
import { collectionPath, getSiteUrl, languageAlternates, localizedUrl } from "@/lib/seo/site-url";

/**
 * /sitemap.xml — every public page in every locale, each entry with hreflang alternates
 * (ru, en, x-default): the landing and every published collection page (/catalog/<slug>).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const data = await getSitemapData();

  const entriesFor = (
    path: string,
    lastModified: string | null,
    priority: number,
    changeFrequency: "daily" | "weekly" | "monthly",
  ): MetadataRoute.Sitemap =>
    locales.map((locale) => ({
      url: localizedUrl(locale, path, siteUrl),
      ...(lastModified ? { lastModified } : {}),
      changeFrequency,
      priority,
      alternates: { languages: languageAlternates(path, siteUrl) },
    }));

  const pages: MetadataRoute.Sitemap = [...entriesFor("/", data.landingLastModified, 1, "weekly")];
  for (const collection of data.collections) {
    pages.push(...entriesFor(collectionPath(collection.slug), collection.lastModified, 0.8, "weekly"));
  }
  return pages;
}
