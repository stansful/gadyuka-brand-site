import { describe, expect, it, vi } from 'vitest';

import type { ApiResult } from '@/lib/api/api-result';
import type { MediaDetailsResponse } from '@shared/contracts/media';

vi.mock('@/lib/admin/auth', () => ({ requireAdminRoute: async () => null }));
const getMediaDetails = vi.fn(async (): Promise<ApiResult<MediaDetailsResponse>> => ({
  ok: true,
  status: 200,
  data: details,
}));
vi.mock('@/lib/api/media', () => ({ getMediaDetails }));
vi.mock('next-intl/server', async () => (await import('../../../../../../test/admin-intl')).nextIntlServerMock);

const details: MediaDetailsResponse = {
  media: {
    id: 'm1',
    url: '/media/admin/u/f/image.webp',
    width: 10,
    height: 8,
    alt: { ru: 'Худи' },
    mime: 'image/webp',
    size: 100,
    originalName: null,
    createdAt: '2026-10-21T00:00:00.000Z',
    usageCount: 1,
  },
  usages: [{ kind: 'productPhoto', href: '/admin/products/p1', title: 'Худи', contentKey: null }],
};

const { GET } = await import('./route');

async function get(id: string): Promise<[number, unknown]> {
  const response = await GET(new Request(`http://site.test/admin/api/media/${id}`), {
    params: Promise.resolve({ id }),
  });
  return [response.status, await response.json()];
}

describe('GET /admin/api/media/[id]', () => {
  it('answers the file with the places that use it, translated', async () => {
    expect(await get('m1')).toEqual([
      200,
      { media: details.media, usages: [{ kind: 'Фото товара', title: 'Худи', href: '/admin/products/p1' }] },
    ]);
    expect(getMediaDetails).toHaveBeenCalledWith('m1');
  });

  it('answers a malformed id and a missing file with their texts', async () => {
    getMediaDetails.mockResolvedValueOnce({
      ok: false,
      failure: { kind: 'validation', status: 400, fields: { id: { key: 'admin.validation.idInvalid' } } },
    });
    expect(await get('42')).toEqual([400, { error: 'Некорректный идентификатор' }]);
    getMediaDetails.mockResolvedValueOnce({
      ok: false,
      failure: { kind: 'domain', status: 404, error: 'notFound', message: { key: 'admin.media.errors.notFound' } },
    });
    expect(await get('m2')).toEqual([404, { error: 'Файл не найден' }]);
  });
});
