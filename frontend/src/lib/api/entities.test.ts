import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiResult } from './api-result';
import type { ApiRequestOptions } from './client';

const adminRequest = vi.fn<(path: string, options?: ApiRequestOptions) => Promise<ApiResult<unknown>>>(async () => ({
  ok: true,
  status: 204,
  data: undefined,
}));
vi.mock('./admin', () => ({ adminRequest }));
const revalidateContent = vi.fn();
vi.mock('@/lib/content/cache', () => ({ revalidateContent, markContentStale: vi.fn() }));
vi.mock('next-intl/server', async () => (await import('../../../test/admin-intl')).nextIntlServerMock);

const { deleteEntity, reorderEntities, setEntityPublished } = await import('./entities');

describe('list operations through the backend', () => {
  beforeEach(() => {
    adminRequest.mockClear();
    revalidateContent.mockClear();
  });

  it('publishes / hides with PATCH …/published and the admin toast', async () => {
    adminRequest.mockResolvedValueOnce({ ok: true, status: 200, data: { id: 'a', published: false } });
    expect(await setEntityPublished('menuItem', 'a', false)).toEqual({
      ok: true,
      data: null,
      message: 'Скрыто с сайта',
    });
    expect(adminRequest).toHaveBeenCalledWith('/api/v1/admin/entities/menuItem/a/published', {
      method: 'PATCH',
      body: { published: false },
    });
    expect(revalidateContent).toHaveBeenCalledOnce();
  });

  it('reorders with POST …/reorder and deletes with DELETE …/:id', async () => {
    expect(await reorderEntities('product', ['b', 'a'])).toEqual({ ok: true, data: null, message: 'Порядок сохранён' });
    expect(adminRequest).toHaveBeenLastCalledWith('/api/v1/admin/entities/product/reorder', {
      method: 'POST',
      body: { ids: ['b', 'a'] },
    });
    expect(await deleteEntity('collection', 'c/1')).toEqual({ ok: true, data: null, message: 'Коллекция удалена' });
    expect(adminRequest).toHaveBeenLastCalledWith('/api/v1/admin/entities/collection/c%2F1', { method: 'DELETE' });
  });

  it('shows the old list messages for a refused request (no form fields), the backend key otherwise', async () => {
    const refused: ApiResult<unknown> = {
      ok: false,
      failure: { kind: 'validation', status: 400, fields: { id: { key: 'admin.validation.idInvalid' } } },
    };
    adminRequest.mockResolvedValueOnce(refused);
    expect(await setEntityPublished('news', 'x', true)).toEqual({ ok: false, error: 'Некорректный запрос' });
    adminRequest.mockResolvedValueOnce(refused);
    expect(await deleteEntity('news', 'x')).toEqual({ ok: false, error: 'Некорректный запрос' });
    adminRequest.mockResolvedValueOnce(refused);
    expect(await reorderEntities('offer', ['x'])).toEqual({ ok: false, error: 'Некорректный порядок' });
    adminRequest.mockResolvedValueOnce({
      ok: false,
      failure: { kind: 'domain', status: 404, error: 'notFound', message: { key: 'admin.errors.notFound' } },
    });
    expect(await deleteEntity('offer', 'a')).toEqual({
      ok: false,
      error: 'Запись не найдена — возможно, её уже удалили. Обновите страницу.',
    });
    expect(revalidateContent).not.toHaveBeenCalled();
  });
});
