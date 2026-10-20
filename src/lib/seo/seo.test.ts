import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { mapLocales, type Locale } from '@/i18n/locales';
import { DEFAULT_MESSAGES } from '@/i18n/messages';
import type { CollectionView, LandingContent, SettingsView, SocialLinkView } from '@/lib/content/types';

import { type BrandCopy, isPlaceholderValue, pageTitle } from './brand';
import { composeMetadata, composeRootMetadata } from './compose';
import { breadcrumbJsonLd, collectionPageJsonLd, landingJsonLd, serializeJsonLd } from './json-ld';
import {
  absoluteUrl,
  isLocalSiteUrl,
  languageAlternates,
  localizedPath,
  localizedUrl,
  normalizeSiteUrl,
  openGraphLocale,
} from './site-url';

const SITE = 'https://gadyuka.ru';

/** The brand messages as getBrandCopy (./brand-copy.ts) resolves them, from the JSON defaults. */
function brandCopy(locale: Locale): BrandCopy {
  const names = mapLocales(other => DEFAULT_MESSAGES[other].brand.name);
  const t = createTranslator({ locale, messages: DEFAULT_MESSAGES[locale], namespace: 'brand' });
  return {
    name: names[locale],
    names,
    city: t('city'),
    titleTemplate: t('pageTitle', { title: '%s', brand: names[locale] }),
  };
}

const BRAND_RU = brandCopy('ru');
const BRAND_EN = brandCopy('en');

const settings: SettingsView = {
  phone: '+7 (861) 200-00-01',
  email: 'hello@gadyuka.ru',
  address: 'ул. Красная, 1',
  reviewRatingMax: 5,
  seoTitle: 'ГАДЮКА — авторская уличная одежда',
  seoDescription: 'Стритвир с авторскими моделями.',
  ogImage: {
    id: 'm1',
    src: '/media/x/og.webp',
    width: 1386,
    height: 780,
    mime: 'image/webp',
    alt: 'Вордмарк',
    altDefault: 'Вордмарк',
  },
};

const socials: SocialLinkView[] = [
  { id: 's1', type: 'TELEGRAM', url: 'https://t.me/gadyuka_brand', label: null },
  { id: 's2', type: 'VK', url: 'https://vk.com/', label: null },
];

describe('site URLs', () => {
  it('normalizes SITE_URL to an origin', () => {
    expect(normalizeSiteUrl('https://gadyuka.ru/')).toBe(SITE);
    expect(normalizeSiteUrl('  https://gadyuka.ru/some/path ')).toBe(SITE);
    expect(normalizeSiteUrl(undefined)).toBe('http://localhost:3000');
    expect(normalizeSiteUrl('ftp://x')).toBe('http://localhost:3000');
    expect(normalizeSiteUrl('not a url')).toBe('http://localhost:3000');
  });

  it('builds as-needed localized paths (ru without prefix)', () => {
    expect(localizedPath('ru', '/')).toBe('/');
    expect(localizedPath('en', '/')).toBe('/en');
    expect(localizedPath('ru', '/catalog/menya-zapomnyat')).toBe('/catalog/menya-zapomnyat');
    expect(localizedPath('en', 'catalog/menya-zapomnyat/')).toBe('/en/catalog/menya-zapomnyat');
  });

  it('builds absolute URLs and hreflang alternates', () => {
    expect(absoluteUrl('/', SITE)).toBe(SITE);
    expect(absoluteUrl('/media/a.webp', SITE)).toBe(`${SITE}/media/a.webp`);
    expect(absoluteUrl('https://cdn.example/x.png', SITE)).toBe('https://cdn.example/x.png');
    expect(localizedUrl('en', '/', SITE)).toBe(`${SITE}/en`);
    expect(languageAlternates('/', SITE)).toEqual({ ru: SITE, en: `${SITE}/en`, 'x-default': SITE });
  });

  it('knows local origins and OG locales', () => {
    expect(isLocalSiteUrl('http://localhost:3000')).toBe(true);
    expect(isLocalSiteUrl(SITE)).toBe(false);
    expect(openGraphLocale('ru')).toBe('ru_RU');
    expect(openGraphLocale('en')).toBe('en_US');
  });
});

describe('composeMetadata', () => {
  it('sets canonical, hreflang (ru/en/x-default), OG and Twitter for the landing', () => {
    const metadata = composeMetadata('en', settings, BRAND_EN, { path: '/' }, SITE);
    expect(metadata.title).toEqual({ absolute: settings.seoTitle });
    expect(metadata.description).toBe(settings.seoDescription);
    expect(metadata.alternates).toEqual({
      canonical: `${SITE}/en`,
      languages: { ru: SITE, en: `${SITE}/en`, 'x-default': SITE },
    });
    expect(metadata.openGraph).toMatchObject({
      url: `${SITE}/en`,
      siteName: BRAND_EN.name,
      locale: 'en_US',
      alternateLocale: ['ru_RU'],
      images: [{ url: `${SITE}/media/x/og.webp`, width: 1386, height: 780, alt: 'Вордмарк', type: 'image/webp' }],
    });
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image', images: [`${SITE}/media/x/og.webp`] });
    expect(metadata.robots).toEqual({ index: true, follow: true });
  });

  it('falls back to the generated OG image and the brand name', () => {
    const metadata = composeMetadata(
      'ru',
      { seoTitle: '', seoDescription: '', ogImage: null },
      BRAND_RU,
      { path: '/' },
      SITE,
    );
    expect(metadata.title).toEqual({ absolute: BRAND_RU.name });
    expect(metadata.description).toBeUndefined();
    expect(metadata.openGraph?.images).toEqual([
      { url: `${SITE}/opengraph-image.png`, width: 1200, height: 630, alt: BRAND_RU.name, type: 'image/png' },
    ]);
  });

  it('supports page titles, custom images and noindex', () => {
    const metadata = composeMetadata(
      'ru',
      settings,
      BRAND_RU,
      { path: '/catalog/menya-zapomnyat', title: 'Меня запомнят', image: null, noIndex: true },
      SITE,
    );
    expect(metadata.title).toEqual({ absolute: `Меня запомнят — ${DEFAULT_MESSAGES.ru.brand.name}` });
    expect(metadata.alternates?.canonical).toBe(`${SITE}/catalog/menya-zapomnyat`);
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('writes the brand in Latin on the English site (titles, og:site_name)', () => {
    const metadata = composeMetadata(
      'en',
      settings,
      BRAND_EN,
      { path: '/catalog/menya-zapomnyat', title: 'They Will Remember Me' },
      SITE,
    );
    expect(DEFAULT_MESSAGES.en.brand.name).toMatch(/^[A-Z]+$/);
    expect(metadata.title).toEqual({ absolute: `They Will Remember Me — ${DEFAULT_MESSAGES.en.brand.name}` });
    expect(metadata.openGraph).toMatchObject({ siteName: DEFAULT_MESSAGES.en.brand.name });
    const fallback = composeMetadata(
      'en',
      { seoTitle: '', seoDescription: '', ogImage: null },
      BRAND_EN,
      { path: '/' },
      SITE,
    );
    expect(fallback.title).toEqual({ absolute: DEFAULT_MESSAGES.en.brand.name });
    const root = composeRootMetadata('en', settings, BRAND_EN, SITE);
    expect(root.title).toEqual({ default: settings.seoTitle, template: `%s — ${DEFAULT_MESSAGES.en.brand.name}` });
    expect(root.applicationName).toBe(DEFAULT_MESSAGES.en.brand.name);
    expect(composeRootMetadata('ru', settings, BRAND_RU, SITE).applicationName).toBe(DEFAULT_MESSAGES.ru.brand.name);
  });

  it('puts page titles into the brand.pageTitle template edited in the admin', () => {
    const edited = { ...BRAND_RU, titleTemplate: `${BRAND_RU.name}: %s` };
    expect(composeMetadata('ru', settings, edited, { title: 'Меня запомнят' }, SITE).title).toEqual({
      absolute: `${BRAND_RU.name}: Меня запомнят`,
    });
    expect(composeRootMetadata('ru', settings, edited, SITE).title).toMatchObject({ template: `${BRAND_RU.name}: %s` });
    // a title with "$&" or "%s" in it is inserted literally
    expect(pageTitle(BRAND_RU, 'A $& B %s')).toBe(`A $& B %s — ${BRAND_RU.name}`);
  });

  it('never indexes local origins; root metadata has no canonical', () => {
    expect(composeMetadata('ru', settings, BRAND_RU, { path: '/' }, 'http://localhost:3000').robots).toEqual({
      index: false,
      follow: false,
    });
    const root = composeRootMetadata('ru', settings, BRAND_RU, SITE);
    expect(root.alternates).toBeUndefined();
    expect(root.metadataBase?.toString()).toBe(`${SITE}/`);
    expect(root.title).toEqual({ default: settings.seoTitle, template: `%s — ${DEFAULT_MESSAGES.ru.brand.name}` });
  });
});

describe('JSON-LD', () => {
  it('escapes script-breaking characters', () => {
    const json = serializeJsonLd({ name: '</script><script>alert(1)</script> & \u2028' });
    expect(json).not.toContain('</script>');
    expect(json).toContain('\\u003c/script\\u003e');
    expect(json).toContain('\\u0026');
    expect(json).toContain('\\u2028');
    expect(JSON.parse(json)).toEqual({ name: '</script><script>alert(1)</script> & \u2028' });
  });

  it('detects placeholder contacts', () => {
    expect(isPlaceholderValue('+7 (000) 000-00-00')).toBe(true);
    expect(isPlaceholderValue('hello@example.com')).toBe(true);
    expect(isPlaceholderValue('Краснодар (адрес — заглушка, укажите в админке)')).toBe(true);
    expect(isPlaceholderValue('+7 (861) 200-00-01')).toBe(false);
    expect(isPlaceholderValue('hello@gadyuka.ru')).toBe(false);
  });

  const collection: CollectionView = {
    id: 'c1',
    slug: 'menya-zapomnyat',
    title: 'Меня запомнят',
    description: 'Худи с тату-графикой',
    cover: null,
    products: [
      {
        id: 'p1',
        slug: 'hoodie-white-logo',
        title: 'Худи «Логотип»',
        description: '',
        details: [],
        price: 6900,
        images: [
          {
            id: 'i1',
            src: '/media/x/hoodie.webp',
            width: 960,
            height: 720,
            mime: 'image/webp',
            alt: '',
            altDefault: '',
          },
        ],
      },
      {
        id: 'p2',
        slug: 'hoodie-scales',
        title: 'Худи «Чешуя»',
        description: 'Чешуя',
        details: [],
        price: null,
        images: [],
      },
    ],
  };

  function landing(overrides: Partial<LandingContent> = {}): LandingContent {
    return {
      locale: 'ru',
      texts: { 'hero.slogan': 'Меня запомнят' } as LandingContent['texts'],
      images: {} as LandingContent['images'],
      menu: [],
      socials,
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

  it('describes the brand as a ClothingStore in Krasnodar with products', () => {
    const data = landingJsonLd(landing(), BRAND_RU, SITE);
    expect(data['@context']).toBe('https://schema.org');
    const graph = data['@graph'];
    expect(Array.isArray(graph)).toBe(true);
    const json = JSON.parse(serializeJsonLd(data)) as { '@graph': Array<Record<string, unknown>> };
    const [store, website, list] = json['@graph'];
    expect(store).toMatchObject({
      '@type': 'ClothingStore',
      name: DEFAULT_MESSAGES.ru.brand.name,
      alternateName: [DEFAULT_MESSAGES.en.brand.name],
      url: SITE,
      logo: { url: `${SITE}/icon.png` },
      slogan: 'Меня запомнят',
      telephone: '+7 (861) 200-00-01',
      address: {
        addressLocality: DEFAULT_MESSAGES.ru.brand.city,
        addressCountry: 'RU',
        streetAddress: 'ул. Красная, 1',
      },
      sameAs: ['https://t.me/gadyuka_brand'],
    });
    expect(website).toMatchObject({
      '@type': 'WebSite',
      name: DEFAULT_MESSAGES.ru.brand.name,
      alternateName: [DEFAULT_MESSAGES.en.brand.name],
      inLanguage: 'ru-RU',
      publisher: { '@id': `${SITE}/#organization` },
    });
    const collectionUrl = `${SITE}/catalog/${collection.slug}`;
    expect(list).toMatchObject({ '@type': 'ItemList', name: 'Меня запомнят', numberOfItems: 2, url: collectionUrl });
    const items = (list?.itemListElement ?? []) as Array<Record<string, unknown> & { item?: Record<string, unknown> }>;
    expect(items[0]?.item).toMatchObject({
      '@type': 'Product',
      name: 'Худи «Логотип»',
      description: 'Худи с тату-графикой',
      image: [`${SITE}/media/x/hoodie.webp`],
      brand: { '@type': 'Brand', name: DEFAULT_MESSAGES.ru.brand.name },
      url: `${collectionUrl}#product-${collection.products[0]?.slug}`,
      offers: { '@type': 'Offer', price: 6900, priceCurrency: 'RUB' },
    });
    // Price on request: no Product without offers (invalid for Google) — a summary ListItem instead.
    expect(items[1]).toEqual({
      '@type': 'ListItem',
      position: 2,
      name: 'Худи «Чешуя»',
      url: `${collectionUrl}#product-${collection.products[1]?.slug}`,
    });
    // every product has its own URL
    expect(new Set(items.map(entry => entry.url ?? entry.item?.url)).size).toBe(2);
  });

  it('collection page: breadcrumbs and an ItemList with the page URL', () => {
    const content = landing({
      locale: 'en',
      texts: {
        'hero.slogan': '',
        'catalog.breadcrumbHome': 'Home',
        'catalog.breadcrumbCatalog': 'Catalog',
      } as LandingContent['texts'],
    });
    const json = JSON.parse(serializeJsonLd(collectionPageJsonLd(content, collection, BRAND_EN, SITE))) as {
      '@graph': Array<Record<string, unknown>>;
    };
    const [, breadcrumbs, list] = json['@graph'];
    const pageUrl = `${SITE}/en/catalog/${collection.slug}`;
    expect(breadcrumbs).toEqual({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/en` },
        { '@type': 'ListItem', position: 2, name: 'Меня запомнят', item: pageUrl },
      ],
    });
    expect(list).toMatchObject({ '@type': 'ItemList', url: pageUrl, '@id': `${pageUrl}#items` });
  });

  it('drops placeholder contacts and empty collections', () => {
    const data = landingJsonLd(
      landing({
        locale: 'en',
        collections: [{ ...collection, products: [] }],
        settings: {
          ...settings,
          phone: '+7 (000) 000-00-00',
          email: 'hello@example.com',
          address: 'Krasnodar (placeholder address)',
        },
      }),
      BRAND_EN,
      SITE,
    );
    const json = JSON.parse(serializeJsonLd(data)) as { '@graph': Array<Record<string, unknown>> };
    expect(json['@graph']).toHaveLength(2);
    // the English site is named in Latin (the SEO title is never the site name)
    expect(json['@graph'][1]).toMatchObject({
      '@type': 'WebSite',
      name: DEFAULT_MESSAGES.en.brand.name,
      alternateName: [DEFAULT_MESSAGES.ru.brand.name],
    });
    const store = json['@graph'][0];
    // the organization keeps its own (default-locale) name on every page
    expect(store?.name).toBe(DEFAULT_MESSAGES.ru.brand.name);
    expect(store?.telephone).toBeUndefined();
    expect(store?.email).toBeUndefined();
    expect(store?.url).toBe(`${SITE}/en`);
    expect(store?.address).toEqual({
      '@type': 'PostalAddress',
      addressLocality: DEFAULT_MESSAGES.en.brand.city,
      addressCountry: 'RU',
    });
  });

  it('builds a BreadcrumbList', () => {
    expect(
      breadcrumbJsonLd([
        { name: 'Главная', url: SITE },
        { name: 'Меня запомнят', url: `${SITE}/catalog/menya-zapomnyat` },
      ]),
    ).toEqual({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Главная', item: SITE },
        { '@type': 'ListItem', position: 2, name: 'Меня запомнят', item: `${SITE}/catalog/menya-zapomnyat` },
      ],
    });
  });
});
