import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiRequestError, type ApiResult } from '@/lib/api/api-result';
import type { ApiRequestOptions } from '@/lib/api/client';
import type { DashboardResponse } from '@shared/contracts/dashboard';

const adminRequest = vi.fn<(path: string, options?: ApiRequestOptions) => Promise<ApiResult<unknown>>>();
vi.mock('@/lib/api/admin', () => ({ adminRequest }));
const requireAdminPage = vi.fn(async () => ({ id: 'admin' }));
vi.mock('../auth', () => ({ requireAdminPage }));

const { getDashboardData, getNewLeadCount } = await import('./dashboard');

const ok = (data: unknown): ApiResult<unknown> => ({ ok: true, status: 200, data });
const count = (total: number, published: number) => ({ total, published });

const DASHBOARD: DashboardResponse = {
  entities: {
    collection: count(2, 1),
    product: count(5, 5),
    review: count(3, 2),
    news: count(1, 0),
    gallery: count(4, 4),
    offer: count(0, 0),
    partner: count(2, 2),
    menuItem: count(6, 5),
    socialLink: count(3, 3),
  },
  media: 12,
  texts: { total: 213, edited: 4, gaps: 2, unsaved: 0 },
  leads: { total: 9, fresh: 3, telegramFailed: 1 },
  latestLeads: [
    {
      id: 'l1',
      type: 'CONTACT',
      status: 'NEW',
      name: 'Аня',
      email: null,
      phone: '+79000000000',
      preview: 'Здравствуйте',
      locale: 'ru',
      telegramSent: true,
      createdAt: '2026-10-21T10:00:00.000Z',
    },
  ],
};

describe('admin dashboard (backend → the cards of the home page)', () => {
  beforeEach(() => {
    adminRequest.mockReset();
    requireAdminPage.mockClear();
  });

  it('builds the cards in the order of the admin menu, with the texts note and the published counts', async () => {
    adminRequest.mockResolvedValue(ok(DASHBOARD));
    const data = await getDashboardData();
    expect(requireAdminPage).toHaveBeenCalledOnce();
    expect(adminRequest).toHaveBeenCalledWith('/api/v1/admin/dashboard');
    expect(data.counts.map(card => [card.href, card.total, card.published])).toEqual([
      ['/admin/content', 213, undefined],
      ['/admin/menu', 6, 5],
      ['/admin/socials', 3, 3],
      ['/admin/collections', 2, 1],
      ['/admin/products', 5, 5],
      ['/admin/reviews', 3, 2],
      ['/admin/news', 1, 0],
      ['/admin/gallery', 4, 4],
      ['/admin/offers', 0, 0],
      ['/admin/partners', 2, 2],
      ['/admin/media', 12, undefined],
    ]);
    expect(data.counts[0]).toMatchObject({ label: 'Тексты сайта', note: 'изменено: 4 · без перевода: 2' });
    expect(data.leads).toEqual({ total: 9, fresh: 3, telegramFailed: 1 });
    expect(data.latestLeads).toEqual(DASHBOARD.latestLeads);
  });

  it('reads the new-leads badge and fails loudly when the backend does', async () => {
    adminRequest.mockResolvedValueOnce(ok({ count: 3 }));
    expect(await getNewLeadCount()).toBe(3);
    expect(adminRequest).toHaveBeenCalledWith('/api/v1/admin/dashboard/new-leads');
    adminRequest.mockResolvedValueOnce({
      ok: false,
      failure: { kind: 'unavailable', status: null, reason: 'network' },
    });
    await expect(getDashboardData()).rejects.toBeInstanceOf(ApiRequestError);
  });
});
