import { defaultLocale } from '@/i18n/locales';
import { getSiteTexts } from '@/i18n/site-messages';
import { getSiteSettings } from '@/lib/content';
import { BRAND } from '@/lib/seo/brand';

import type { MetadataRoute } from 'next';

/**
 * /manifest.webmanifest — brand colors (black background, red icon), icons from src/app/icon.png.
 * One manifest for the whole site, in the default language. Its texts are the site's own,
 * editable in the admin: the app name is the SEO title of «Настройки» (else the brand name),
 * the short name the brand name (message brand.name), the description the SEO description.
 * Cached like the rest of the content (both reads are "use cache" + cacheTag("content")).
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const [texts, settings] = await Promise.all([getSiteTexts(defaultLocale), getSiteSettings(defaultLocale)]);
  const brand = texts['brand.name'];
  return {
    name: settings.seoTitle || brand,
    short_name: brand,
    description: settings.seoDescription || undefined,
    lang: defaultLocale,
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: BRAND.colors.black,
    theme_color: BRAND.colors.black,
    categories: ['shopping', 'lifestyle'],
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
    ],
  };
}
