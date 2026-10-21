import 'server-only';
import type { MediaUsageView } from '@/components/admin/media/media-types';
import { isImageKey, isSectionId } from '@/lib/content/registry';
import type { MediaUsage } from '@shared/contracts/media';

import type { AdminTranslator } from './i18n';

import { getAdminTranslations } from './i18n-server';

type UsagesTranslator = AdminTranslator<'admin.media.usages'>;
type SiteTextsTranslator = AdminTranslator<'admin.siteTexts'>;

/**
 * The places that use a media file (backend: kind + stored title + admin link) as the admin shows
 * them: «<kind>: <title>» (admin.media.usages). A landing image is named «<section> — <image>»
 * (admin.siteTexts), an untitled gallery photo «Фото галереи», the settings «OG-картинка…».
 */
export async function translateMediaUsages(usages: readonly MediaUsage[]): Promise<MediaUsageView[]> {
  const [t, tTexts] = await Promise.all([
    getAdminTranslations('admin.media.usages'),
    getAdminTranslations('admin.siteTexts'),
  ]);
  return usages.map(usage => ({ kind: t(usage.kind), title: titleOf(usage, t, tTexts), href: usage.href }));
}

function titleOf(usage: MediaUsage, t: UsagesTranslator, tTexts: SiteTextsTranslator): string {
  switch (usage.kind) {
    case 'landingImage':
      return landingImageTitle(usage.contentKey ?? '', t, tTexts);
    case 'gallery':
      return usage.title || t('galleryPhoto');
    case 'settings':
      return t('ogImage');
    default:
      return usage.title;
  }
}

/** "about.image" → «О бренде — Фото в блоке «О бренде»»; a key the registry does not know → the key. */
function landingImageTitle(key: string, t: UsagesTranslator, tTexts: SiteTextsTranslator): string {
  if (!isImageKey(key)) return key;
  const section = key.split('.')[0] ?? key;
  return t('landingImageTitle', {
    section: isSectionId(section) ? tTexts(`sections.${section}`) : section,
    image: tTexts(`images.${key}`),
  });
}
