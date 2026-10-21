import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiFailure, ApiResult } from '@/lib/api/api-result';
import type { ApiRequestOptions } from '@/lib/api/client';
import type {
  AdminCollectionSaveRequest,
  AdminProductSaveRequest,
  AdminReviewSaveRequest,
} from '@shared/contracts/catalog';

const adminRequest = vi.fn<(path: string, options?: ApiRequestOptions) => Promise<ApiResult<unknown>>>();
vi.mock('@/lib/api/admin', () => ({ adminRequest }));
const revalidateContent = vi.fn();
vi.mock('@/lib/content/cache', () => ({ revalidateContent, markContentStale: vi.fn() }));

const { saveCollection } = await import('./collections');
const { saveProduct } = await import('./products');
const { saveReview } = await import('./reviews');
const { saveSettings } = await import('./settings');

const COLLECTION: AdminCollectionSaveRequest = {
  slug: 'menya-zapomnyat',
  title: { ru: 'Меня запомнят' },
  description: {},
  coverId: null,
  published: true,
};
const PRODUCT: AdminProductSaveRequest = {
  slug: 'hoodie',
  collectionId: 'c1',
  title: { ru: 'Худи' },
  description: {},
  details: {},
  price: null,
  imageIds: ['m1'],
  published: false,
};
const REVIEW: AdminReviewSaveRequest = {
  author: 'Анна',
  role: {},
  text: { ru: 'Отлично' },
  avatarId: null,
  rating: 6,
  published: true,
};
const SETTINGS = {
  phone: '',
  email: '',
  address: {},
  reviewRatingMax: 3,
  seoTitle: {},
  seoDescription: {},
  ogImageId: null,
};

function refused(status: number, key: string, values?: Record<string, number>): ApiResult<never> {
  const failure: ApiFailure = {
    kind: 'domain',
    status,
    error: status === 409 ? 'conflict' : 'badRequest',
    message: values ? { key, values } : { key },
  };
  return { ok: false, failure };
}

describe('catalog save actions through the backend', () => {
  beforeEach(() => {
    adminRequest.mockReset();
    revalidateContent.mockClear();
  });

  it('creates with POST and updates with PUT, with the old success toasts, then refreshes the site', async () => {
    adminRequest.mockResolvedValue({ ok: true, status: 201, data: { id: 'new-id' } });
    expect(await saveCollection(null, COLLECTION)).toEqual({
      ok: true,
      data: { id: 'new-id' },
      message: 'Коллекция создана',
    });
    expect(adminRequest).toHaveBeenLastCalledWith('/api/v1/admin/collections', { method: 'POST', body: COLLECTION });
    expect(await saveProduct('p/1', PRODUCT)).toEqual({ ok: true, data: { id: 'new-id' }, message: 'Товар сохранён' });
    expect(adminRequest).toHaveBeenLastCalledWith('/api/v1/admin/products/p%2F1', { method: 'PUT', body: PRODUCT });
    expect(await saveReview(null, REVIEW)).toMatchObject({ ok: true, message: 'Отзыв добавлен' });
    expect(await saveSettings(SETTINGS)).toEqual({ ok: true, data: null, message: 'Настройки сохранены' });
    expect(adminRequest).toHaveBeenLastCalledWith('/api/v1/admin/settings', { method: 'PUT', body: SETTINGS });
    expect(revalidateContent).toHaveBeenCalledTimes(4);
  });

  it('shows a taken slug as the toast and at the slug field (the entity’s own message)', async () => {
    adminRequest.mockResolvedValue(refused(409, 'admin.errors.slugTaken'));
    expect(await saveCollection('c1', COLLECTION)).toEqual({
      ok: false,
      error: 'Адрес уже занят',
      fieldErrors: { slug: 'Коллекция с таким адресом уже есть' },
    });
    expect(await saveProduct(null, PRODUCT)).toEqual({
      ok: false,
      error: 'Адрес уже занят',
      fieldErrors: { slug: 'Товар с таким адресом уже есть' },
    });
    expect(revalidateContent).not.toHaveBeenCalled();
  });

  it('marks the picker of a deleted media file and a deleted collection of a product', async () => {
    const missingMedia = 'Выбранное изображение не найдено в медиатеке — выберите другое.';
    adminRequest.mockResolvedValue(refused(400, 'admin.errors.missingMedia'));
    expect(await saveCollection(null, COLLECTION)).toEqual({
      ok: false,
      error: missingMedia,
      fieldErrors: { coverId: missingMedia },
    });
    expect(await saveProduct(null, PRODUCT)).toEqual({
      ok: false,
      error: missingMedia,
      fieldErrors: { imageIds: missingMedia },
    });
    expect(await saveReview(null, REVIEW)).toEqual({
      ok: false,
      error: missingMedia,
      fieldErrors: { avatarId: missingMedia },
    });
    expect(await saveSettings(SETTINGS)).toEqual({
      ok: false,
      error: missingMedia,
      fieldErrors: { ogImageId: missingMedia },
    });
    adminRequest.mockResolvedValue(refused(400, 'admin.products.collectionNotFound'));
    expect(await saveProduct(null, PRODUCT)).toEqual({
      ok: false,
      error: 'Коллекция не найдена',
      fieldErrors: { collectionId: 'Выберите коллекцию' },
    });
  });

  it('explains a rating above the star scale and a scale below stored ratings with their numbers', async () => {
    adminRequest.mockResolvedValue(refused(400, 'admin.reviews.ratingAboveScale', { rating: 6, max: 5 }));
    expect(await saveReview('r1', REVIEW)).toEqual({
      ok: false,
      error: 'Оценка 6 больше шкалы',
      fieldErrors: { rating: 'Оценка от 1 до 5 — так настроена шкала в «Настройках»' },
    });
    adminRequest.mockResolvedValue(refused(409, 'admin.settings.scaleTooLow', { count: 2, max: 3 }));
    expect(await saveSettings(SETTINGS)).toEqual({
      ok: false,
      error: 'Шкалу нельзя уменьшить до 3: у 2 отзывов оценка выше',
      fieldErrors: {
        reviewRatingMax:
          'У 2 отзывов оценка выше 3. Сначала снизьте их оценки в разделе «Отзывы» — или оставьте шкалу больше.',
      },
    });
  });

  it('shows other refusals as their own message only (deleted product, malformed id, races)', async () => {
    adminRequest.mockResolvedValueOnce({
      ok: false,
      failure: { kind: 'domain', status: 404, error: 'notFound', message: { key: 'admin.products.notFound' } },
    });
    expect(await saveProduct('p1', PRODUCT)).toEqual({
      ok: false,
      error: 'Товар не найден — возможно, его уже удалили.',
    });
    adminRequest.mockResolvedValueOnce(refused(400, 'admin.errors.invalidId'));
    expect(await saveReview('seed-review-1', REVIEW)).toEqual({ ok: false, error: 'Некорректный идентификатор' });
    adminRequest.mockResolvedValueOnce(refused(409, 'admin.errors.duplicate'));
    expect(await saveCollection(null, COLLECTION)).toEqual({
      ok: false,
      error: 'Запись с таким значением уже существует (проверьте адрес / slug).',
    });
  });

  it('translates the field errors of a refused form', async () => {
    adminRequest.mockResolvedValue({
      ok: false,
      failure: {
        kind: 'validation',
        status: 400,
        fields: {
          'title.ru': { key: 'admin.validation.requiredText', values: { locale: 'ru' } },
          price: { key: 'admin.validation.priceTooHigh', values: { max: 100_000_000 } },
        },
      },
    });
    const result = await saveProduct(null, PRODUCT);
    expect(result).toMatchObject({
      ok: false,
      error: 'Проверьте поля формы — есть ошибки',
      fieldErrors: { 'title.ru': 'Заполните текст на языке по умолчанию (ru)' },
    });
    expect(!result.ok && result.fieldErrors?.price).toMatch(/^Цена не больше 100\s000\s000 ₽/);
  });
});
