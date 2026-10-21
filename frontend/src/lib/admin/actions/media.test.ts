import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiResult } from '@/lib/api/api-result';
import type { MediaAltResponse, MediaDetailsResponse } from '@shared/contracts/media';

const saveMediaAlt = vi.fn(async (): Promise<ApiResult<MediaAltResponse>> => ({
  ok: true,
  status: 200,
  data: { id: 'm1', alt: { ru: 'Худи' } },
}));
const deleteMediaFile = vi.fn(async (): Promise<ApiResult<void>> => ({ ok: true, status: 204, data: undefined }));
const getMediaDetails = vi.fn(async (): Promise<ApiResult<MediaDetailsResponse>> => ({
  ok: false,
  failure: { kind: 'unavailable', status: null, reason: 'network' },
}));
vi.mock('@/lib/api/media', () => ({ saveMediaAlt, deleteMediaFile, getMediaDetails }));
const revalidateContent = vi.fn();
vi.mock('@/lib/content/cache', () => ({ revalidateContent, markContentStale: vi.fn() }));
vi.mock('next-intl/server', async () => (await import('../../../../test/admin-intl')).nextIntlServerMock);

const { deleteMedia, updateMediaAlt } = await import('./media');

const IN_USE: ApiResult<void> = {
  ok: false,
  failure: {
    kind: 'domain',
    status: 409,
    error: 'conflict',
    message: { key: 'admin.media.errors.inUse' },
    details: { usageCount: 1 },
  },
};

describe('media actions', () => {
  beforeEach(() => {
    revalidateContent.mockClear();
    getMediaDetails.mockClear();
  });

  it('saves the alt text: the stored translations and «Описание сохранено», the site refreshed', async () => {
    expect(await updateMediaAlt('m1', { ru: ' Худи ', en: '' })).toEqual({
      ok: true,
      data: { alt: { ru: 'Худи' } },
      message: 'Описание сохранено',
    });
    expect(saveMediaAlt).toHaveBeenCalledWith('m1', { ru: ' Худи ', en: '' });
    expect(revalidateContent).toHaveBeenCalledOnce();
  });

  it('shows a too long translation on its field', async () => {
    saveMediaAlt.mockResolvedValueOnce({
      ok: false,
      failure: {
        kind: 'validation',
        status: 400,
        fields: { 'alt.en': { key: 'admin.validation.tooLong', values: { max: 300 } } },
      },
    });
    expect(await updateMediaAlt('m1', { en: 'x'.repeat(301) })).toEqual({
      ok: false,
      error: 'Проверьте поля формы — есть ошибки',
      fieldErrors: { 'alt.en': 'Не длиннее 300 символов' },
    });
  });

  it('deletes an unused file with «Файл удалён»', async () => {
    expect(await deleteMedia('m1')).toEqual({ ok: true, data: null, message: 'Файл удалён' });
    expect(revalidateContent).toHaveBeenCalledOnce();
  });

  it('refuses a file in use with the places that use it', async () => {
    deleteMediaFile.mockResolvedValueOnce(IN_USE);
    getMediaDetails.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: {
        media: {
          id: 'm1',
          url: '/media/x',
          width: 1,
          height: 1,
          alt: {},
          mime: 'image/webp',
          size: 1,
          originalName: null,
          createdAt: '2026-10-21T00:00:00.000Z',
          usageCount: 1,
        },
        usages: [{ kind: 'settings', href: '/admin/settings', title: '', contentKey: null }],
      },
    });
    expect(await deleteMedia('m1')).toEqual({
      ok: false,
      error: 'Файл используется на сайте — сначала замените или уберите его там.',
      usages: [{ kind: 'Настройки', title: 'OG-картинка для соцсетей', href: '/admin/settings' }],
    });
    expect(revalidateContent).not.toHaveBeenCalled();
  });

  it('shows a missing file, a malformed id and a file in use whose places cannot be loaded as one message', async () => {
    deleteMediaFile.mockResolvedValueOnce({
      ok: false,
      failure: {
        kind: 'domain',
        status: 404,
        error: 'notFound',
        message: { key: 'admin.media.errors.notFoundDeleted' },
      },
    });
    expect(await deleteMedia('m2')).toEqual({ ok: false, error: 'Файл не найден — возможно, его уже удалили.' });
    deleteMediaFile.mockResolvedValueOnce({
      ok: false,
      failure: { kind: 'validation', status: 400, fields: { id: { key: 'admin.validation.idInvalid' } } },
    });
    expect(await deleteMedia('42')).toEqual({ ok: false, error: 'Некорректный идентификатор' });
    deleteMediaFile.mockResolvedValueOnce(IN_USE);
    expect(await deleteMedia('m3')).toEqual({
      ok: false,
      error: 'Файл используется на сайте — сначала замените или уберите его там.',
    });
  });
});
