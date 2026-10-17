import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { toLocale } from "@/i18n/locales";
import { notFoundMetadata } from "@/lib/seo/metadata";

/** Unknown paths inside a locale render the localized [locale]/not-found.tsx. */

// A 404 catch-all never needs instant-navigation validation (it always throws notFound()).
export const instant = false;

/** «Страница не найдена — ГАДЮКА» / «Page not found — GADYUKA» instead of the site title. */
export async function generateMetadata({ params }: PageProps<"/[locale]/[...rest]">): Promise<Metadata> {
  return notFoundMetadata(toLocale((await params).locale));
}

export default function CatchAllPage(): never {
  notFound();
}
