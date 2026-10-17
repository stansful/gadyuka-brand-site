import "server-only";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/locales";
import { getSiteSettings } from "@/lib/content";
import { brandName } from "./brand";
import { type BuildMetadataOptions, composeMetadata, composeRootMetadata } from "./compose";

/**
 * Next.js metadata for public pages, driven by SiteSettings SEO fields (cached via
 * getSiteSettings → "use cache" + cacheTag("content")).
 *
 *   // page.tsx
 *   export async function generateMetadata({ params }: PageProps<"/[locale]">) {
 *     return buildMetadata(toLocale((await params).locale), { path: "/" });
 *   }
 *   // catalog/[slug]/page.tsx
 *   buildMetadata(locale, { path: collectionPath(slug), title: collection.title,
 *                           description: collection.description, image: collection.cover })
 */
export async function buildMetadata(locale: Locale, options: BuildMetadataOptions = {}): Promise<Metadata> {
  const settings = await getSiteSettings(locale);
  return composeMetadata(locale, settings, options);
}

/** Site-wide defaults for src/app/[locale]/layout.tsx (metadataBase, title template, OG/Twitter). */
export async function buildRootMetadata(locale: Locale): Promise<Metadata> {
  const settings = await getSiteSettings(locale);
  return composeRootMetadata(locale, settings);
}

/** 404 pages: «Страница не найдена — ГАДЮКА», never indexed (no canonical / hreflang). */
export async function notFoundMetadata(locale: Locale): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "notFound" });
  return { title: { absolute: `${t("title")} — ${brandName(locale)}` }, robots: { index: false, follow: false } };
}

export type { BuildMetadataOptions } from "./compose";
