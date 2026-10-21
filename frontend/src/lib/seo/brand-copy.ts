import 'server-only';
import { getTranslations } from 'next-intl/server';

import { locales, mapLocales, type Locale } from '@/i18n/locales';

import type { BrandCopy } from './brand';

/**
 * The brand as the site messages spell it (brand.* — DB rows over shared/messages/*.json, cached with
 * the rest of the content): the page locale's name, city and title template plus the name in
 * every locale (structured data names the organization the same way on every page).
 */
export async function getBrandCopy(locale: Locale): Promise<BrandCopy> {
  const t = await getTranslations({ locale, namespace: 'brand' });
  const name = t('name');
  const names = mapLocales(other => (other === locale ? name : ''));
  await Promise.all(
    locales
      .filter(other => other !== locale)
      .map(async other => {
        names[other] = (await getTranslations({ locale: other, namespace: 'brand' }))('name');
      }),
  );
  return { name, names, city: t('city'), titleTemplate: t('pageTitle', { title: '%s', brand: name }) };
}
