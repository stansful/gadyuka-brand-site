import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiRequestError, type ApiResult } from '@/lib/api/api-result';
import type { ApiRequestOptions } from '@/lib/api/client';
import type { SiteTextsPageResponse } from '@shared/contracts/site-texts';

const adminRequest = vi.fn<(path: string, options?: ApiRequestOptions) => Promise<ApiResult<unknown>>>();
vi.mock('@/lib/api/admin', () => ({ adminRequest }));
const requireAdminPage = vi.fn(async () => ({ id: 'admin' }));
vi.mock('../auth', () => ({ requireAdminPage }));

const { getSiteTextsPage } = await import('./site-texts');

const PAGE: SiteTextsPageResponse = {
  sections: [{ id: 'hero', total: 1, edited: 0, gaps: 0, unsaved: 0 }],
  mode: 'search',
  section: null,
  query: 'гадюка',
  groups: [
    {
      section: 'hero',
      entries: [
        {
          key: 'hero.title',
          kind: 'text',
          required: true,
          values: { ru: 'ГАДЮКА', en: 'GADYUKA' },
          defaults: { ru: 'ГАДЮКА', en: 'GADYUKA' },
          edited: {},
          missing: [],
          placeholders: [],
          tags: [],
        },
      ],
      images: [],
    },
  ],
};

describe('«Тексты сайта» page data (backend → the editor)', () => {
  beforeEach(() => {
    adminRequest.mockReset();
    requireAdminPage.mockClear();
  });

  it('asks the backend for the section or the search and names what it shows', async () => {
    adminRequest.mockResolvedValue({ ok: true, status: 200, data: PAGE });
    const data = await getSiteTextsPage({ section: 'about', query: ' гадюка ' });
    expect(requireAdminPage).toHaveBeenCalledOnce();
    expect(adminRequest).toHaveBeenCalledWith('/api/v1/admin/site-texts', {
      query: { section: 'about', q: ' гадюка ' },
    });
    expect(data.sections[0]?.label).toMatch(/[А-Яа-я]/);
    expect(data.groups[0]).toMatchObject({ section: 'hero', anchor: 'home', label: data.sections[0]?.label });
    expect(data.groups[0]?.entries[0]?.label).toMatch(/[А-Яа-я]/);
    expect(data.query).toBe('гадюка');
  });

  it('fails loudly when the backend does (the admin error page)', async () => {
    adminRequest.mockResolvedValue({ ok: false, failure: { kind: 'unavailable', status: null, reason: 'timeout' } });
    await expect(getSiteTextsPage({ section: null, query: '' })).rejects.toBeInstanceOf(ApiRequestError);
  });
});
