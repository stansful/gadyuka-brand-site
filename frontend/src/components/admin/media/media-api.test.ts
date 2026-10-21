import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchMediaDetails, fetchMediaPage, MediaApiError } from './media-api';

const media = {
  id: 'm1',
  url: '/media/admin/u1/f1/image.webp',
  width: 1200,
  height: 800,
  alt: { ru: 'Худи', en: 'Hoodie', de: 'ignored' },
  mime: 'image/webp',
  size: 12_345,
  originalName: null,
  createdAt: '2026-01-02T03:04:05.000Z',
  usageCount: 2,
};

function respondWith(body: unknown, status = 200): void {
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify(body), { status }));
}

async function problemOf(promise: Promise<unknown>): Promise<unknown> {
  const error: unknown = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(MediaApiError);
  return error instanceof MediaApiError ? error.problem : null;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('admin media API client', () => {
  it('parses a page of media (alt keeps known locales only, unknown properties are dropped)', async () => {
    respondWith({ items: [{ ...media, extra: true }], nextCursor: 'c2' });
    await expect(fetchMediaPage({})).resolves.toEqual({
      items: [{ ...media, alt: { ru: 'Худи', en: 'Hoodie' } }],
      nextCursor: 'c2',
    });
  });

  it('parses the details with the places that use the file', async () => {
    const usages = [{ kind: 'Фото товара', title: 'Худи', href: '/admin/products/p1' }];
    respondWith({ media: { ...media, originalName: 'hoodie.jpg' }, usages });
    await expect(fetchMediaDetails('m1')).resolves.toEqual({
      media: { ...media, originalName: 'hoodie.jpg', alt: { ru: 'Худи', en: 'Hoodie' } },
      usages,
    });
  });

  it.each([
    null,
    [],
    { items: [], nextCursor: 1 },
    { items: [{ ...media, width: '1200' }], nextCursor: null },
    { items: [{ ...media, originalName: 5 }], nextCursor: null },
    { items: {}, nextCursor: null },
  ])('reports a malformed page %j as unexpected', async body => {
    respondWith(body);
    expect(await problemOf(fetchMediaPage({}))).toEqual({ key: 'unexpected' });
  });

  it("shows the server's own error text, else a problem by status", async () => {
    respondWith({ error: 'Файл используется' }, 409);
    expect(await problemOf(fetchMediaDetails('m1'))).toEqual({ text: 'Файл используется' });
    respondWith({ error: 42 }, 401);
    expect(await problemOf(fetchMediaDetails('m1'))).toEqual({ key: 'sessionExpired' });
    respondWith(null, 500);
    expect(await problemOf(fetchMediaPage({}))).toEqual({ key: 'server', values: { status: 500 } });
  });
});
