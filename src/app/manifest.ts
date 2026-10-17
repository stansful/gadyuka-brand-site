import type { MetadataRoute } from "next";
import { defaultLocale } from "@/i18n/locales";
import { BRAND } from "@/lib/seo/brand";

/** /manifest.webmanifest — brand colors (black background, red icon), icons from src/app/icon.png. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name} — ${BRAND.slogan.ru}`,
    short_name: BRAND.name,
    description: "Авторская уличная одежда из Краснодара: коллекция «Меня запомнят» и индивидуальный пошив.",
    lang: defaultLocale,
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: BRAND.colors.black,
    theme_color: BRAND.colors.black,
    categories: ["shopping", "lifestyle"],
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
