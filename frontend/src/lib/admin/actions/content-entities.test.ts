import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiResult } from '@/lib/api/api-result';
import type { ApiRequestOptions } from '@/lib/api/client';

/**
 * The Server Actions of the content entities (news, gallery, offers, partners, menu, social links)
 * against a stubbed backend: request, success toast, refreshed site, and the field errors of the
 * domain errors the forms showed before. The backend side: backend/src/usecases/admin/content.
 */

const adminRequest = vi.fn<(path: string, options?: ApiRequestOptions) => Promise<ApiResult<unknown>>>();
vi.mock('@/lib/api/admin', () => ({ adminRequest }));
const revalidateContent = vi.fn();
vi.mock('@/lib/content/cache', () => ({ revalidateContent, markContentStale: vi.fn() }));

const { saveNews } = await import('./news');
const { addGalleryItems, saveGalleryItem } = await import('./gallery');
const { saveOffer } = await import('./offers');
const { savePartner } = await import('./partners');
const { saveMenuItem } = await import('./menu');
const { saveSocialLink } = await import('./socials');

const saved = (id: string): ApiResult<unknown> => ({ ok: true, status: 200, data: { id } });

function domainError(status: number, key: string): ApiResult<unknown> {
  const error = status === 409 ? 'conflict' : 'badRequest';
  return { ok: false, failure: { kind: 'domain', status, error, message: { key } } };
}

const news = {
  slug: 'pop-up',
  title: { ru: 'Поп-ап' },
  excerpt: {},
  body: {},
  date: '2026-10-01',
  imageId: null,
  published: true,
};

const offer = {
  title: { ru: 'Скидка' },
  text: {},
  badge: {},
  ctaLabel: { ru: 'Купить' },
  ctaHref: null,
  validUntil: null,
  imageId: null,
  published: true,
};

beforeEach(() => {
  adminRequest.mockReset();
  revalidateContent.mockReset();
});

describe('create / update through the backend', () => {
  it('creates with POST and updates with PUT …/:id, refreshing the site with the right toast', async () => {
    adminRequest.mockResolvedValueOnce(saved('n1'));
    expect(await saveNews(null, news)).toEqual({ ok: true, data: { id: 'n1' }, message: 'Новость создана' });
    expect(adminRequest).toHaveBeenLastCalledWith('/api/v1/admin/news', { method: 'POST', body: news });
    adminRequest.mockResolvedValueOnce(saved('n/1'));
    expect(await saveNews('n/1', news)).toEqual({ ok: true, data: { id: 'n/1' }, message: 'Новость сохранена' });
    expect(adminRequest).toHaveBeenLastCalledWith('/api/v1/admin/news/n%2F1', { method: 'PUT', body: news });
    expect(revalidateContent).toHaveBeenCalledTimes(2);
  });

  it('uses each entity route and its own messages', async () => {
    adminRequest.mockResolvedValue(saved('x'));
    const gallery = { mediaId: 'm', caption: {}, published: true };
    expect((await saveGalleryItem(null, gallery)).ok && adminRequest.mock.lastCall?.[0]).toBe('/api/v1/admin/gallery');
    expect(await saveOffer('x', { ...offer, ctaHref: '#contacts' })).toMatchObject({
      message: 'Предложение сохранено',
    });
    expect(adminRequest.mock.lastCall?.[0]).toBe('/api/v1/admin/offers/x');
    const partner = { name: 'Бренд', url: null, logoId: null, description: {}, published: true };
    expect(await savePartner(null, partner)).toMatchObject({ message: 'Партнёр добавлен' });
    expect(adminRequest.mock.lastCall?.[0]).toBe('/api/v1/admin/partners');
    const item = {
      label: { ru: 'Каталог' },
      href: '#catalog',
      showInHeader: true,
      showInFooter: true,
      published: true,
    };
    expect(await saveMenuItem('x', item)).toMatchObject({ message: 'Пункт меню сохранён' });
    expect(adminRequest.mock.lastCall?.[0]).toBe('/api/v1/admin/menu-items/x');
    const link = { type: 'TELEGRAM', url: 'https://t.me/gadyuka', label: {}, published: true } as const;
    expect(await saveSocialLink(null, link)).toMatchObject({ message: 'Ссылка добавлена' });
    expect(adminRequest.mock.lastCall?.[0]).toBe('/api/v1/admin/social-links');
  });

  it('adds several photos with POST /gallery/bulk', async () => {
    adminRequest.mockResolvedValueOnce({ ok: true, status: 201, data: { count: 3 } });
    expect(await addGalleryItems({ mediaIds: ['a', 'b', 'c'], published: true })).toEqual({
      ok: true,
      data: { count: 3 },
      message: 'Добавлено фото: 3',
    });
    expect(adminRequest).toHaveBeenCalledWith('/api/v1/admin/gallery/bulk', {
      method: 'POST',
      body: { mediaIds: ['a', 'b', 'c'], published: true },
    });
  });
});

describe('errors as the forms showed them', () => {
  it('a taken news slug: the form error and its own message on the slug field', async () => {
    adminRequest.mockResolvedValueOnce(domainError(409, 'admin.errors.slugTaken'));
    expect(await saveNews(null, news)).toEqual({
      ok: false,
      error: 'Адрес уже занят',
      fieldErrors: { slug: 'Новость с таким адресом уже есть' },
    });
    expect(revalidateContent).not.toHaveBeenCalled();
  });

  it('a picture that no longer exists: the same message on the picker of the entity', async () => {
    const message = 'Выбранное изображение не найдено в медиатеке — выберите другое.';
    adminRequest.mockResolvedValue(domainError(400, 'admin.errors.missingMedia'));
    expect(await saveNews('n', news)).toEqual({ ok: false, error: message, fieldErrors: { imageId: message } });
    expect(await saveGalleryItem('g', { mediaId: 'm', caption: {}, published: true })).toEqual({
      ok: false,
      error: message,
      fieldErrors: { mediaId: message },
    });
    const partner = { name: 'Бренд', url: null, logoId: 'm', description: {}, published: true };
    expect(await savePartner('p', partner)).toEqual({ ok: false, error: message, fieldErrors: { logoId: message } });
    expect(await addGalleryItems({ mediaIds: ['m'], published: true })).toEqual({ ok: false, error: message });
  });

  it('a button label without a link: the offer form error and the link field message', async () => {
    adminRequest.mockResolvedValueOnce(domainError(400, 'admin.offers.ctaHrefRequired'));
    expect(await saveOffer(null, offer)).toEqual({
      ok: false,
      error: 'Укажите ссылку для кнопки',
      fieldErrors: { ctaHref: 'Кнопке нужна ссылка (или очистите подпись кнопки)' },
    });
  });

  it('validation fields with their translated keys, and a malformed id as one message', async () => {
    adminRequest.mockResolvedValueOnce({
      ok: false,
      failure: {
        kind: 'validation',
        status: 400,
        fields: {
          'title.ru': { key: 'admin.validation.requiredText', values: { locale: 'ru' } },
          href: { key: 'admin.validation.hrefBareHash' },
        },
      },
    });
    const item = { label: { en: 'Catalog' }, href: '#', showInHeader: true, showInFooter: true, published: true };
    expect(await saveMenuItem(null, item)).toEqual({
      ok: false,
      error: 'Проверьте поля формы — есть ошибки',
      fieldErrors: {
        'title.ru': 'Заполните текст на языке по умолчанию (ru)',
        href: 'После # укажите раздел, например: #catalog',
      },
    });
    adminRequest.mockResolvedValueOnce(domainError(400, 'admin.errors.invalidId'));
    expect(await saveMenuItem('bad id', item)).toEqual({ ok: false, error: 'Некорректный идентификатор' });
  });
});
