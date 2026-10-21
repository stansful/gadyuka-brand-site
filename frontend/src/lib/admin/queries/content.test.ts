import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiResult } from '@/lib/api/api-result';
import type { ApiRequestOptions } from '@/lib/api/client';
import type { MediaRef } from '@shared/contracts/common';

/**
 * The admin page data of the content entities: backend answers (shared/contracts/content-entities.ts)
 * → the rows of the admin lists and the edit forms, as the pages showed them before.
 */

const adminRequest = vi.fn<(path: string, options?: ApiRequestOptions) => Promise<ApiResult<unknown>>>();
vi.mock('@/lib/api/admin', () => ({ adminRequest }));
const requireAdminPage = vi.fn(async () => ({ id: 'u', role: 'ADMIN' }));
vi.mock('../auth', () => ({ requireAdminPage }));

const content = await import('./content');

const ok = (data: unknown): ApiResult<unknown> => ({ ok: true, status: 200, data });
const image: MediaRef = { id: 'm1', url: '/media/admin/u/x/image.webp', width: 1200, height: 800, alt: {} };

beforeEach(() => {
  adminRequest.mockReset();
  requireAdminPage.mockClear();
});

describe('admin lists of the content entities', () => {
  it('news: headline (else the slug), the address, the Moscow day, untranslated locales', async () => {
    adminRequest.mockResolvedValueOnce(
      ok({
        items: [
          { id: 'n1', slug: 'pop-up', title: { ru: 'Поп-ап' }, date: '2026-10-31', image, published: true },
          { id: 'n2', slug: 'draft', title: {}, date: '2026-01-05', image: null, published: false },
        ],
      }),
    );
    expect(await content.listNewsAdmin()).toEqual([
      {
        id: 'n1',
        title: 'Поп-ап',
        subtitle: '/pop-up',
        thumb: image,
        href: '/admin/news/n1',
        published: true,
        missingLocales: ['en'],
        meta: '31.10.2026',
      },
      {
        id: 'n2',
        title: 'draft',
        subtitle: '/draft',
        thumb: null,
        href: '/admin/news/n2',
        published: false,
        missingLocales: ['ru', 'en'],
        meta: '05.01.2026',
      },
    ]);
    expect(requireAdminPage).toHaveBeenCalledOnce();
    expect(adminRequest).toHaveBeenCalledWith('/api/v1/admin/news');
  });

  it('offers: the badge, the last day or «бессрочно», expired ones explained', async () => {
    adminRequest.mockResolvedValueOnce(
      ok({
        items: [
          {
            id: 'o1',
            title: { ru: 'Скидка' },
            badge: { ru: '−15%' },
            validUntil: '2020-01-31',
            expired: true,
            image: null,
            published: true,
          },
          {
            id: 'o2',
            title: { ru: 'Всегда', en: 'Always' },
            badge: {},
            validUntil: null,
            expired: false,
            image,
            published: false,
          },
        ],
      }),
    );
    const rows = await content.listOffersAdmin();
    expect(rows.map(row => [row.title, row.subtitle, row.meta, row.missingLocales])).toEqual([
      ['Скидка', '−15%', 'до 31.01.2020 — истекло, на сайте не показывается', ['en']],
      ['Всегда', undefined, 'бессрочно', []],
    ]);
  });

  it('gallery: the caption or «Без подписи», no translation badge without a caption', async () => {
    adminRequest.mockResolvedValueOnce(
      ok({
        items: [
          { id: 'g1', media: image, caption: { ru: 'Подпись' }, published: true },
          { id: 'g2', media: image, caption: {}, published: false },
        ],
      }),
    );
    const rows = await content.listGalleryAdmin();
    expect(rows.map(row => [row.title, row.thumb, row.href, row.missingLocales])).toEqual([
      ['Подпись', image, '/admin/gallery/g1', ['en']],
      ['Без подписи', image, '/admin/gallery/g2', []],
    ]);
  });

  it('partners: the name, the link, a translation badge only with a description', async () => {
    adminRequest.mockResolvedValueOnce(
      ok({
        items: [
          {
            id: 'p1',
            name: 'Бренд',
            url: 'https://example.ru',
            logo: image,
            description: { ru: 'О нас' },
            published: true,
          },
          { id: 'p2', name: 'Друзья', url: null, logo: null, description: {}, published: false },
        ],
      }),
    );
    const rows = await content.listPartnersAdmin();
    expect(rows.map(row => [row.title, row.subtitle, row.thumb, row.missingLocales])).toEqual([
      ['Бренд', 'https://example.ru', image, ['en']],
      ['Друзья', undefined, null, []],
    ]);
  });

  it('menu: the label (else the link) and where the item is shown', async () => {
    adminRequest.mockResolvedValueOnce(
      ok({
        items: [
          {
            id: 'i1',
            label: { ru: 'Каталог', en: 'Catalog' },
            href: '#catalog',
            showInHeader: true,
            showInFooter: true,
            published: true,
          },
          { id: 'i2', label: {}, href: '/catalog/x', showInHeader: false, showInFooter: true, published: true },
          { id: 'i3', label: { ru: 'Скрыт' }, href: '#a', showInHeader: false, showInFooter: false, published: false },
        ],
      }),
    );
    const rows = await content.listMenuItemsAdmin();
    expect(rows.map(row => [row.title, row.subtitle, row.meta, row.href])).toEqual([
      ['Каталог', '#catalog', 'в шапке · в подвале', '/admin/menu/i1'],
      ['/catalog/x', '/catalog/x', 'в подвале', '/admin/menu/i2'],
      ['Скрыт', '#a', 'не показывается: выключены и шапка, и подвал', '/admin/menu/i3'],
    ]);
  });

  it('social links: own label or the type name, default-label and placeholder notes', async () => {
    adminRequest.mockResolvedValueOnce(
      ok({
        items: [
          { id: 's1', type: 'TELEGRAM', url: 'https://t.me/', label: {}, bareUrl: true, published: true },
          {
            id: 's2',
            type: 'VK',
            url: 'https://vk.com/g',
            label: { ru: 'Сообщество' },
            bareUrl: false,
            published: true,
          },
        ],
      }),
    );
    const rows = await content.listSocialLinksAdmin();
    expect(rows.map(row => [row.title, row.subtitle, row.meta, row.missingLocales])).toEqual([
      ['Telegram', 'https://t.me/', 'название по умолчанию · заглушка: в ссылке нет адреса профиля', []],
      ['Сообщество', 'https://vk.com/g', 'ВКонтакте', ['en']],
    ]);
  });

  it('a backend failure is thrown (the error page), not shown as an empty list', async () => {
    adminRequest.mockResolvedValueOnce({
      ok: false,
      failure: { kind: 'unavailable', status: null, reason: 'network' },
    });
    await expect(content.listPartnersAdmin()).rejects.toThrow('/api/v1/admin/partners');
  });
});

describe('edit forms and their suggestions', () => {
  it('answers the row, or null for a missing row or a malformed id (the page shows «not found»)', async () => {
    const offer = { id: 'o1', title: { ru: 'Скидка' } };
    adminRequest.mockResolvedValueOnce(ok(offer));
    expect(await content.getOfferForm('o1')).toEqual(offer);
    expect(adminRequest).toHaveBeenLastCalledWith('/api/v1/admin/offers/o1');
    adminRequest.mockResolvedValueOnce({
      ok: false,
      failure: { kind: 'domain', status: 404, error: 'notFound', message: { key: 'admin.errors.notFound' } },
    });
    expect(await content.getNewsForm('gone')).toBeNull();
    adminRequest.mockResolvedValueOnce({
      ok: false,
      failure: { kind: 'domain', status: 400, error: 'badRequest', message: { key: 'admin.errors.invalidId' } },
    });
    expect(await content.getGalleryForm('../x')).toBeNull();
    expect(adminRequest).toHaveBeenLastCalledWith('/api/v1/admin/gallery/..%2Fx');
  });

  it('menu link suggestions: landing anchors by section name, the lead form, then the collections', async () => {
    adminRequest.mockResolvedValueOnce(
      ok({
        collections: [
          { slug: 'menya-zapomnyat', title: { ru: 'Меня запомнят' } },
          { slug: 'no-title', title: {} },
        ],
      }),
    );
    const options = await content.getMenuHrefOptions();
    expect(adminRequest).toHaveBeenCalledWith('/api/v1/admin/menu-items/link-targets');
    expect(options.slice(0, 2)).toEqual([
      { href: '#home', label: 'Главная (обложка)' },
      { href: '#catalog', label: 'Каталог' },
    ]);
    expect(options.slice(-3)).toEqual([
      { href: '#lead-form', label: 'Форма заявки' },
      { href: '/catalog/menya-zapomnyat', label: 'Коллекция «Меня запомнят»' },
      { href: '/catalog/no-title', label: 'Коллекция «no-title»' },
    ]);
  });

  it('social default labels come from the backend as they are', async () => {
    const labels = { TELEGRAM: { ru: 'Telegram', en: 'Telegram' } };
    adminRequest.mockResolvedValueOnce(ok({ labels }));
    expect(await content.getSocialDefaultLabels()).toEqual(labels);
    expect(adminRequest).toHaveBeenCalledWith('/api/v1/admin/social-links/default-labels');
  });
});
