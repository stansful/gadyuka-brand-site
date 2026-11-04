import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiFailure, ApiResult } from '@/lib/api/api-result';
import type { MediaUploadRequest } from '@/lib/api/media';
import type { MediaItem, MediaListResponse } from '@shared/contracts/media';

const requireAdminRoute = vi.fn(async (): Promise<Response | null> => null);
vi.mock('@/lib/admin/auth', () => ({ requireAdminRoute }));
const listMediaPage = vi.fn(async (): Promise<ApiResult<MediaListResponse>> => ({
  ok: true,
  status: 200,
  data: { items: [], nextCursor: 'c2', total: 7 },
}));
const uploadMediaStream = vi.fn(async (_upload: MediaUploadRequest): Promise<ApiResult<MediaItem>> => ({
  ok: true,
  status: 201,
  data: media,
}));
vi.mock('@/lib/api/media', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/api/media')>()),
  listMediaPage,
  uploadMediaStream,
}));
vi.mock('next-intl/server', async () => (await import('../../../../../test/admin-intl')).nextIntlServerMock);

const media: MediaItem = {
  id: 'm1',
  url: '/media/admin/u/f/image.webp',
  width: 10,
  height: 8,
  alt: {},
  mime: 'image/webp',
  size: 100,
  originalName: 'a.png',
  createdAt: '2026-10-21T00:00:00.000Z',
  usageCount: 0,
};

const { GET, POST } = await import('./route');

function upload(body: BodyInit | null, headers: Record<string, string>): Request {
  return new Request('http://site.test/admin/api/media', { method: 'POST', body, headers });
}

function domain(status: number, key: string, values?: Record<string, string | number>): ApiResult<never> {
  const failure: ApiFailure = {
    kind: 'domain',
    status,
    error: 'badRequest',
    message: values ? { key, values } : { key },
  };
  return { ok: false, failure };
}

async function answer(response: Response): Promise<[number, unknown]> {
  return [response.status, await response.json()];
}

describe('GET /admin/api/media', () => {
  beforeEach(() => listMediaPage.mockClear());

  it('answers a page of the library (the total stays on the page) and passes cursor and search on', async () => {
    const response = await GET(new Request('http://site.test/admin/api/media?cursor=c1&q=%20худи'));
    expect(await answer(response)).toEqual([200, { items: [], nextCursor: 'c2' }]);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(listMediaPage).toHaveBeenCalledWith({ cursor: 'c1', q: ' худи' });
  });

  it('shows a refused cursor as its text, a backend outage as a bare 500', async () => {
    listMediaPage.mockResolvedValueOnce({
      ok: false,
      failure: { kind: 'validation', status: 400, fields: { cursor: { key: 'admin.media.errors.badCursor' } } },
    });
    expect(await answer(await GET(new Request('http://site.test/admin/api/media?cursor=x')))).toEqual([
      400,
      { error: 'Некорректный курсор' },
    ]);
    listMediaPage.mockResolvedValueOnce({
      ok: false,
      failure: { kind: 'unavailable', status: null, reason: 'network' },
    });
    vi.spyOn(console, 'error').mockImplementationOnce(() => undefined);
    expect(await answer(await GET(new Request('http://site.test/admin/api/media')))).toEqual([500, {}]);
  });

  it('answers the session check instead when it refuses', async () => {
    requireAdminRoute.mockResolvedValueOnce(Response.json({ error: 'no session' }, { status: 401 }));
    expect((await GET(new Request('http://site.test/admin/api/media'))).status).toBe(401);
    expect(listMediaPage).not.toHaveBeenCalled();
  });
});

describe('POST /admin/api/media', () => {
  const MULTIPART = { 'content-type': 'multipart/form-data; boundary=x' };

  beforeEach(() => uploadMediaStream.mockClear());

  it('streams a multipart body to the backend and answers 201 { media }', async () => {
    expect(await answer(await POST(upload('--x--', { ...MULTIPART, 'content-length': '5' })))).toEqual([
      201,
      { media },
    ]);
    expect(uploadMediaStream).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: MULTIPART['content-type'],
        contentLength: 5,
        body: expect.any(ReadableStream),
      }),
    );
  });

  it('refuses what is not a multipart upload as before, without calling the backend', async () => {
    const form = upload('file=x', { 'content-type': 'application/x-www-form-urlencoded' });
    expect(await answer(await POST(form))).toEqual([400, { error: 'Файл не передан' }]);
    expect(await answer(await POST(upload('{}', { 'content-type': 'application/json' })))).toEqual([
      400,
      { error: 'Не удалось прочитать файл из запроса' },
    ]);
    expect(
      await answer(
        await POST(upload('x', { ...MULTIPART, 'content-length': String(50 * 1024 * 1024 + 512 * 1024 + 1) })),
      ),
    ).toEqual([413, { error: 'Файл больше 50 МБ' }]);
    expect(uploadMediaStream).not.toHaveBeenCalled();
  });

  it("shows the backend's refusal as its text, anything else as «Не удалось сохранить файл»", async () => {
    uploadMediaStream.mockResolvedValueOnce(
      domain(415, 'admin.media.errors.unsupported', { formats: 'JPEG, PNG, WebP, AVIF, GIF' }),
    );
    expect(await answer(await POST(upload('--x--', MULTIPART)))).toEqual([
      415,
      { error: 'Неподдерживаемый формат. Можно загружать: JPEG, PNG, WebP, AVIF, GIF' },
    ]);
    uploadMediaStream.mockResolvedValueOnce(domain(502, 'admin.errors.actionFailed'));
    vi.spyOn(console, 'error').mockImplementationOnce(() => undefined);
    expect(await answer(await POST(upload('--x--', MULTIPART)))).toEqual([
      500,
      { error: 'Не удалось сохранить файл. Попробуйте ещё раз.' },
    ]);
  });
});
