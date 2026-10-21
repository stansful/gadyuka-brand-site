import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_MESSAGES } from '@/i18n/messages';
import type { ApiFailure, ApiResult } from '@/lib/api/api-result';
import type { ImageRef } from '@shared/contracts/common';
import type { LandingResponse, PublicCollection, PublicSettings } from '@shared/contracts/content';

// ── mocks: no Next.js request scope, no backend ──────────────────────────────
const cache = vi.hoisted(() => ({ life: [] as unknown[], tags: [] as unknown[] }));
vi.mock('next/cache', () => ({
  cacheLife: (profile: unknown) => cache.life.push(profile),
  cacheTag: (tag: unknown) => cache.tags.push(tag),
}));
vi.mock('next/server', () => ({ connection: async (): Promise<void> => undefined }));
const apiRequest = vi.hoisted(() => vi.fn<(path: string, options?: unknown) => Promise<ApiResult<unknown>>>());
vi.mock('@/lib/api/client', () => ({ apiRequest }));
const publicRead = vi.hoisted(() => vi.fn<(path: string) => Promise<unknown>>());
vi.mock('@/lib/api/public', () => ({ publicRead }));

const { getCollectionBySlug, getLanding, getSiteSettings } = await import('./landing');
const { toLandingContent } = await import('./mappers');
const { offerExpiryCacheLife } = await import('./offer-cache-life');

const now = new Date('2026-10-16T20:00:00.000Z');
const at = (minutes: number): string => new Date(now.getTime() + minutes * 60_000).toISOString();

const image = (id: string): ImageRef => ({
  id,
  src: `/media/admin/u/${id}/image.webp`,
  width: 4,
  height: 3,
  mime: 'image/webp',
  alt: '',
  altDefault: 'Фото',
});

const settings: PublicSettings = {
  phone: '+7 900',
  email: 'hello@example.com',
  address: 'Москва',
  reviewRatingMax: 5,
  seoTitle: 'ГАДЮКА',
  seoDescription: '',
  ogImage: null,
};

const collection: PublicCollection = {
  id: 'c1',
  slug: 'noir',
  title: 'Нуар',
  description: '',
  cover: image('m0'),
  products: [
    {
      id: 'p1',
      slug: 'coat',
      title: 'Пальто',
      description: '',
      details: ['шерсть'],
      price: null,
      images: [image('m1')],
    },
  ],
};

const landing = (changes: Partial<LandingResponse> = {}): LandingResponse => ({
  locale: 'en',
  texts: { 'hero.title': 'GADYUKA (edited)' },
  images: { 'about.image': image('m2'), 'removed.image': image('m3') },
  menu: [{ id: 'm1', label: 'About', href: '#about', showInHeader: true, showInFooter: false }],
  socials: [{ id: 's1', type: 'TELEGRAM', url: 'https://t.me/gadyuka', label: null }],
  collections: [collection],
  reviews: [{ id: 'r1', author: 'Аня', role: '', text: 'Great', avatar: null, rating: 5 }],
  news: [],
  gallery: [{ id: 'g1', caption: '', image: image('m4') }],
  offers: [],
  partners: [],
  settings,
  offersExpireAt: null,
  ...changes,
});

const ok = <T>(data: T): ApiResult<T> => ({ ok: true, status: 200, data });

beforeEach(() => {
  cache.life = [];
  cache.tags = [];
  apiRequest.mockReset();
  publicRead.mockReset();
  vi.useFakeTimers({ now, toFake: ['Date'] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('offerExpiryCacheLife', () => {
  it('keeps the regular profile without an offer ending within the hour', () => {
    expect(offerExpiryCacheLife(null, now)).toBeNull();
    expect(offerExpiryCacheLife(at(90), now)).toBeNull();
  });

  it('revalidates right after the earliest end', () => {
    expect(offerExpiryCacheLife(at(10), now)).toEqual({ stale: 300, revalidate: 10 * 60 + 1, expire: 86_400 });
  });

  it('never revalidates more often than once a minute (an end already passed included)', () => {
    expect(offerExpiryCacheLife(new Date(now.getTime() + 5_000).toISOString(), now)?.revalidate).toBe(60);
    expect(offerExpiryCacheLife(at(-1), now)?.revalidate).toBe(60);
  });
});

describe('toLandingContent: the backend answer → the components’ view', () => {
  it('fills every message key: the backend value, else the bundled default of the locale', () => {
    const content = toLandingContent(landing(), now);
    expect(content.texts['hero.title']).toBe('GADYUKA (edited)');
    expect(content.texts['notFound.title']).toBe(DEFAULT_MESSAGES.en.notFound.title);
    expect(Object.keys(content.texts)).not.toContain('removed.key');
  });

  it('has every landing image slot of the registry, null when the backend has none', () => {
    const content = toLandingContent(landing(), now);
    expect(content.images).toEqual({ 'about.image': image('m2'), 'tailoring.image': null });
  });

  it('keeps the lists, the catalog and the settings as answered, and dates the footer', () => {
    const response = landing();
    const content = toLandingContent(response, now);
    expect(content).toMatchObject({
      locale: 'en',
      menu: response.menu,
      socials: response.socials,
      collections: [collection],
      reviews: response.reviews,
      gallery: response.gallery,
      settings,
      year: 2026,
    });
    expect(content.collections[0]?.products[0]?.details).not.toBe(collection.products[0]?.details);
  });
});

describe('getLanding (GET /public/landing/:locale, cached)', () => {
  it('reads the landing of the locale and caches it with the content tag for hours', async () => {
    apiRequest.mockResolvedValue(ok(landing()));
    const content = await getLanding('en');
    expect(apiRequest).toHaveBeenCalledWith('/api/v1/public/landing/en', { query: undefined });
    expect(content.texts['hero.title']).toBe('GADYUKA (edited)');
    expect(cache).toEqual({ tags: ['content'], life: ['hours'] });
  });

  it('shortens the cache life before the earliest offer end', async () => {
    apiRequest.mockResolvedValue(ok(landing({ offersExpireAt: at(10) })));
    await getLanding('ru');
    expect(cache.life).toEqual([{ stale: 300, revalidate: 601, expire: 86_400 }]);
  });

  it('throws when the backend cannot answer (nothing is cached)', async () => {
    apiRequest.mockResolvedValue({ ok: false, failure: { kind: 'unavailable', status: null, reason: 'network' } });
    await expect(getLanding('ru')).rejects.toThrow('/api/v1/public/landing/ru');
    expect(cache.life).toEqual([]);
  });
});

describe('getCollectionBySlug (GET /public/collections/:slug?locale=, cached)', () => {
  it('reads the collection of the slug in the locale', async () => {
    apiRequest.mockResolvedValue(ok({ locale: 'en', collection }));
    expect(await getCollectionBySlug('en', 'noir')).toEqual(collection);
    expect(apiRequest).toHaveBeenCalledWith('/api/v1/public/collections/noir', { query: { locale: 'en' } });
  });

  it('is null for a missing or hidden collection (404) and for a slug that cannot exist (400)', async () => {
    const notFound: ApiFailure = {
      kind: 'domain',
      status: 404,
      error: 'notFound',
      message: { key: 'admin.errors.notFound' },
    };
    apiRequest.mockResolvedValueOnce({ ok: false, failure: notFound });
    expect(await getCollectionBySlug('ru', 'gone')).toBeNull();
    const invalid: ApiFailure = {
      kind: 'validation',
      status: 400,
      fields: { slug: { key: 'admin.validation.invalid' } },
    };
    apiRequest.mockResolvedValueOnce({ ok: false, failure: invalid });
    expect(await getCollectionBySlug('ru', 'a/b?c')).toBeNull();
    expect(apiRequest).toHaveBeenLastCalledWith('/api/v1/public/collections/a%2Fb%3Fc', { query: { locale: 'ru' } });
  });

  it('throws when the backend cannot answer', async () => {
    apiRequest.mockResolvedValue({ ok: false, failure: { kind: 'unavailable', status: 502, reason: 'badResponse' } });
    await expect(getCollectionBySlug('ru', 'noir')).rejects.toThrow('unavailable');
  });
});

describe('getSiteSettings (GET /public/settings/:locale)', () => {
  it('reads the settings of the locale through the cached public read', async () => {
    publicRead.mockResolvedValue({ locale: 'en', settings });
    expect(await getSiteSettings('en')).toEqual(settings);
    expect(publicRead).toHaveBeenCalledWith('/api/v1/public/settings/en');
  });
});
