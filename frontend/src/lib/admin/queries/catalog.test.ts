import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiRequestError, type ApiResult } from '@/lib/api/api-result';
import type { ApiRequestOptions } from '@/lib/api/client';
import type {
  AdminCollectionListResponse,
  AdminProductListResponse,
  AdminReviewListResponse,
} from '@shared/contracts/catalog';

import { formatRubles } from '../labels';

const adminRequest = vi.fn<(path: string, options?: ApiRequestOptions) => Promise<ApiResult<unknown>>>();
vi.mock('@/lib/api/admin', () => ({ adminRequest }));
const requireAdminPage = vi.fn(async () => ({ id: 'admin' }));
vi.mock('../auth', () => ({ requireAdminPage }));

const catalog = await import('./catalog');

const ok = (data: unknown): ApiResult<unknown> => ({ ok: true, status: 200, data });
const COVER = { id: 'm1', url: '/media/admin/u/m1/image.webp', width: 1200, height: 800, alt: { ru: 'Обложка' } };

describe('catalog admin queries (backend → admin list rows / forms)', () => {
  beforeEach(() => {
    adminRequest.mockReset();
    requireAdminPage.mockClear();
  });

  it('lists collections with the product count and the delete warning', async () => {
    const list: AdminCollectionListResponse = {
      items: [
        { id: 'c1', slug: 'drop', title: { ru: 'Дроп', en: 'Drop' }, published: true, cover: COVER, productCount: 3 },
        { id: 'c2', slug: 'empty', title: {}, published: false, cover: null, productCount: 0 },
      ],
    };
    adminRequest.mockResolvedValue(ok(list));
    expect(await catalog.listCollectionsAdmin()).toEqual([
      {
        id: 'c1',
        title: 'Дроп',
        subtitle: '/drop',
        thumb: COVER,
        href: '/admin/collections/c1',
        published: true,
        missingLocales: [],
        meta: '3 товара',
        deleteWarning: 'Вместе с коллекцией будут удалены 3 товара.',
      },
      {
        id: 'c2',
        title: 'empty',
        subtitle: '/empty',
        thumb: null,
        href: '/admin/collections/c2',
        published: false,
        missingLocales: ['ru', 'en'],
        meta: '0 товаров',
        deleteWarning: undefined,
      },
    ]);
    expect(adminRequest).toHaveBeenCalledWith('/api/v1/admin/collections');
    expect(requireAdminPage).toHaveBeenCalledOnce();
    expect(await catalog.getCollectionOptions()).toEqual([
      { id: 'c1', slug: 'drop', title: 'Дроп' },
      { id: 'c2', slug: 'empty', title: 'empty' },
    ]);
  });

  it('groups products by collection with price and photo count', async () => {
    const list: AdminProductListResponse = {
      groups: [
        {
          collection: { id: 'c1', slug: 'drop', title: { ru: 'Дроп' }, published: false },
          products: [
            {
              id: 'p1',
              slug: 'hoodie',
              title: { ru: 'Худи' },
              price: 12900,
              published: true,
              cover: COVER,
              imageCount: 2,
            },
            { id: 'p2', slug: 'cap', title: {}, price: null, published: false, cover: null, imageCount: 0 },
          ],
        },
      ],
    };
    adminRequest.mockResolvedValue(ok(list));
    const [group] = await catalog.listProductsAdmin();
    expect(group?.collection).toEqual({ id: 'c1', slug: 'drop', title: 'Дроп', published: false });
    expect(group?.rows.map(row => [row.title, row.subtitle, row.meta, row.href, row.thumb])).toEqual([
      ['Худи', '/hoodie', `${formatRubles(12900)} · 2 фото`, '/admin/products/p1', COVER],
      ['cap', '/cap', 'цена по запросу · 0 фото', '/admin/products/p2', null],
    ]);
  });

  it('lists reviews with stars on the current scale, marks ratings above it, filters by ratingAbove', async () => {
    const long = 'Очень '.repeat(30);
    const list: AdminReviewListResponse = {
      ratingMax: 5,
      items: [
        {
          id: 'r1',
          author: 'Анна',
          role: { ru: 'покупатель' },
          text: { ru: 'Отлично' },
          rating: 4,
          published: true,
          avatar: null,
        },
        {
          id: 'r2',
          author: 'Сергей',
          role: {},
          text: { ru: long, en: 'Great' },
          rating: 7,
          published: false,
          avatar: COVER,
        },
        { id: 'r3', author: 'Ира', role: {}, text: { ru: 'Без оценки' }, rating: null, published: true, avatar: null },
      ],
    };
    adminRequest.mockResolvedValue(ok(list));
    const rows = await catalog.listReviewsAdmin({ ratingAbove: 3 });
    expect(adminRequest).toHaveBeenCalledWith('/api/v1/admin/reviews', { query: { ratingAbove: 3 } });
    expect(rows.map(row => row.meta)).toEqual(['покупатель · ★★★★☆', '7 из 5 — выше шкалы', undefined]);
    expect(rows[1]?.subtitle).toBe(`${long.trim().slice(0, 120)}…`);
    expect(rows.map(row => row.missingLocales)).toEqual([['en'], [], ['en']]);
    expect(rows[0]?.subtitle).toBe('Отлично');
  });

  it('answers null for a row that does not exist or a malformed id, and throws when the backend fails', async () => {
    adminRequest.mockResolvedValueOnce({
      ok: false,
      failure: { kind: 'domain', status: 404, error: 'notFound', message: { key: 'admin.errors.notFound' } },
    });
    expect(await catalog.getCollectionForm('c/1')).toBeNull();
    expect(adminRequest).toHaveBeenLastCalledWith('/api/v1/admin/collections/c%2F1');
    adminRequest.mockResolvedValueOnce({
      ok: false,
      failure: { kind: 'domain', status: 400, error: 'badRequest', message: { key: 'admin.errors.invalidId' } },
    });
    expect(await catalog.getReviewForm('seed-review-1')).toBeNull();
    adminRequest.mockResolvedValueOnce({
      ok: false,
      failure: { kind: 'unavailable', status: null, reason: 'network' },
    });
    await expect(catalog.getProductForm('p1')).rejects.toBeInstanceOf(ApiRequestError);
    adminRequest.mockResolvedValueOnce({
      ok: false,
      failure: { kind: 'unavailable', status: 502, reason: 'badResponse' },
    });
    await expect(catalog.getSettingsForm()).rejects.toBeInstanceOf(ApiRequestError);
  });

  it('reads the star scale and the settings form as the backend answers them', async () => {
    adminRequest.mockResolvedValueOnce(ok({ max: 7 }));
    expect(await catalog.getReviewRatingMax()).toBe(7);
    expect(adminRequest).toHaveBeenLastCalledWith('/api/v1/admin/reviews/rating-scale');
    const settings = {
      phone: '',
      email: '',
      address: {},
      reviewRatingMax: 5,
      seoTitle: {},
      seoDescription: {},
      ogImage: null,
    };
    adminRequest.mockResolvedValueOnce(ok(settings));
    expect(await catalog.getSettingsForm()).toEqual(settings);
  });
});
