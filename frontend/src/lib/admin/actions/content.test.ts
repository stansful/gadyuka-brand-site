import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiResult } from '@/lib/api/api-result';
import type { ApiRequestOptions } from '@/lib/api/client';

/**
 * saveSiteTexts / resetSiteText against a stubbed backend: what the editor gets for every answer of
 * PUT /api/v1/admin/site-texts and POST …/reset (the backend side is tested end to end in
 * backend/src/usecases/admin/site-texts).
 */

const adminRequest = vi.fn<(path: string, options?: ApiRequestOptions) => Promise<ApiResult<unknown>>>();
vi.mock('@/lib/api/admin', () => ({ adminRequest }));
const revalidateContent = vi.fn();
const markContentStale = vi.fn();
vi.mock('@/lib/content/cache', () => ({ revalidateContent, markContentStale }));
vi.mock('next-intl/server', async () => (await import('../../../../test/admin-intl')).nextIntlServerMock);

const { resetSiteText, saveSiteTexts } = await import('./content');

const SLOGAN = 'hero.slogan';
const entries = [{ key: SLOGAN, values: { ru: { value: ' Новый слоган ', base: 'Меня запомнят' } } }];

function failing(failure: Extract<ApiResult<unknown>, { ok: false }>['failure']): ApiResult<unknown> {
  return { ok: false, failure };
}

beforeEach(() => {
  adminRequest.mockReset();
  revalidateContent.mockReset();
  markContentStale.mockReset();
});

/** The backend's transaction may take 35 s (site-texts.store.ts): the client waits longer than its default 10 s. */
const WRITE_TIMEOUT_MS = 45_000;

describe('saveSiteTexts', () => {
  it('sends the changes with PUT and refreshes the site when something was written', async () => {
    adminRequest.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: { saved: 1, values: { [SLOGAN]: { ru: 'Новый слоган' } } },
    });
    expect(await saveSiteTexts({ entries, images: [] })).toEqual({
      ok: true,
      data: { saved: 1, values: { [SLOGAN]: { ru: 'Новый слоган' } } },
      message: 'Тексты сохранены — сайт обновлён',
    });
    expect(adminRequest).toHaveBeenCalledWith('/api/v1/admin/site-texts', {
      method: 'PUT',
      body: { entries, images: [] },
      timeoutMs: WRITE_TIMEOUT_MS,
    });
    expect(revalidateContent).toHaveBeenCalledOnce();
    expect(markContentStale).not.toHaveBeenCalled();
  });

  it('reports «no changes» without refreshing the site', async () => {
    adminRequest.mockResolvedValueOnce({ ok: true, status: 200, data: { saved: 0, values: {} } });
    expect(await saveSiteTexts({ entries: [], images: [] })).toEqual({
      ok: true,
      data: { saved: 0, values: {} },
      message: 'Изменений нет — всё уже сохранено',
    });
    expect(revalidateContent).not.toHaveBeenCalled();
  });

  it('names the texts and images changed in another tab (409) with the stored text per field', async () => {
    adminRequest.mockResolvedValueOnce(
      failing({
        kind: 'domain',
        status: 409,
        error: 'conflict',
        message: { key: 'admin.siteTexts.errors.conflict' },
        details: { 'hero.title.ru': 'ГАДЮКА 2.0', 'about.image': true },
      }),
    );
    const result = await saveSiteTexts({ entries, images: [] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/^Ничего не сохранено/);
    expect(result.error).toContain('(RU)');
    expect(result.error).toContain('картинку «Фото»');
    expect(result.fieldErrors?.['hero.title.ru']).toContain('«ГАДЮКА 2.0»');
    expect(result.fieldErrors?.['about.image']).toMatch(/обновите страницу/);
    expect(revalidateContent).not.toHaveBeenCalled();
  });

  it('shows «Исправьте ошибки в текстах» with the error of every text ("<key>.<locale>")', async () => {
    adminRequest.mockResolvedValueOnce(
      failing({
        kind: 'validation',
        status: 400,
        fields: {
          '': { key: 'admin.siteTexts.errors.fixErrors' },
          'hero.title.ru': { key: 'admin.siteTexts.errors.required' },
          'catalog.models.en': {
            key: 'admin.siteTexts.errors.unknownArgument',
            values: { token: '{total}', allowed: '{count}' },
          },
        },
      }),
    );
    expect(await saveSiteTexts({ entries, images: [] })).toEqual({
      ok: false,
      error: 'Исправьте ошибки в текстах',
      fieldErrors: {
        'hero.title.ru': expect.stringMatching(/^Обязательный текст/),
        'catalog.models.en': 'Неизвестная подстановка {total} — в этом тексте доступны: {count}',
      },
    });
  });

  it('shows «Проверьте поля формы» for a request refused by shape (the editor re-keys the indexes)', async () => {
    adminRequest.mockResolvedValueOnce(
      failing({
        kind: 'validation',
        status: 400,
        fields: { 'entries.0.values.ru.value': { key: 'admin.validation.tooLong', values: { max: 10_000 } } },
      }),
    );
    const result = await saveSiteTexts({ entries, images: [] });
    expect(result).toEqual({
      ok: false,
      error: 'Проверьте поля формы — есть ошибки',
      fieldErrors: { 'entries.0.values.ru.value': expect.stringContaining('10') },
    });
  });

  it('shows the missing media on the image and as the message', async () => {
    adminRequest.mockResolvedValueOnce(
      failing({
        kind: 'validation',
        status: 400,
        fields: { '': { key: 'admin.errors.missingMedia' }, 'about.image': { key: 'admin.errors.missingMedia' } },
      }),
    );
    const missing = 'Выбранное изображение не найдено в медиатеке — выберите другое.';
    expect(await saveSiteTexts({ entries: [], images: [] })).toEqual({
      ok: false,
      error: missing,
      fieldErrors: { 'about.image': missing },
    });
  });

  it('answers «Не удалось выполнить действие» when the backend is unreachable and «Сессия истекла» on 401', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    adminRequest.mockResolvedValueOnce(failing({ kind: 'unavailable', status: null, reason: 'network' }));
    expect(await saveSiteTexts({ entries, images: [] })).toEqual({
      ok: false,
      error: 'Не удалось выполнить действие. Попробуйте ещё раз.',
    });
    adminRequest.mockRejectedValueOnce(new Error('boom'));
    expect((await saveSiteTexts({ entries, images: [] })).ok).toBe(false);
    error.mockRestore();
    adminRequest.mockResolvedValueOnce(
      failing({ kind: 'domain', status: 401, error: 'unauthorized', message: { key: 'admin.auth.sessionRequired' } }),
    );
    expect(await saveSiteTexts({ entries, images: [] })).toEqual({
      ok: false,
      error: 'Сессия истекла. Обновите страницу и войдите снова.',
    });
  });

  it('marks the site stale when the save may have landed: no usable answer, a 5xx, a throw — not a refusal', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const unknownOutcomes = [
      failing({ kind: 'unavailable', status: null, reason: 'timeout' }),
      failing({ kind: 'unavailable', status: null, reason: 'network' }),
      failing({ kind: 'unavailable', status: 502, reason: 'badResponse' }),
      failing({ kind: 'domain', status: 500, error: 'internal', message: { key: 'admin.errors.actionFailed' } }),
    ];
    for (const outcome of unknownOutcomes) adminRequest.mockResolvedValueOnce(outcome);
    adminRequest.mockRejectedValueOnce(new Error('boom'));
    for (let call = 0; call <= unknownOutcomes.length; call += 1) {
      expect((await saveSiteTexts({ entries, images: [] })).ok).toBe(false);
    }
    expect(markContentStale).toHaveBeenCalledTimes(unknownOutcomes.length + 1);
    expect(revalidateContent).not.toHaveBeenCalled();

    markContentStale.mockReset();
    adminRequest.mockResolvedValueOnce(failing({ kind: 'unavailable', status: null, reason: 'config' }));
    adminRequest.mockResolvedValueOnce(
      failing({ kind: 'domain', status: 409, error: 'conflict', message: { key: 'admin.siteTexts.errors.conflict' } }),
    );
    adminRequest.mockResolvedValueOnce(
      failing({ kind: 'validation', status: 400, fields: { '': { key: 'admin.siteTexts.errors.fixErrors' } } }),
    );
    for (let call = 0; call < 3; call += 1) await saveSiteTexts({ entries, images: [] });
    expect(markContentStale).not.toHaveBeenCalled();
    error.mockRestore();
  });
});

describe('resetSiteText', () => {
  it('restores the defaults with POST …/reset and refreshes the site', async () => {
    const values = { ru: 'Меня запомнят', en: 'They will remember me' };
    adminRequest.mockResolvedValueOnce({ ok: true, status: 200, data: { key: SLOGAN, values } });
    expect(await resetSiteText(SLOGAN)).toEqual({
      ok: true,
      data: { values },
      message: 'Текст по умолчанию восстановлен',
    });
    expect(adminRequest).toHaveBeenCalledWith('/api/v1/admin/site-texts/reset', {
      method: 'POST',
      body: { key: SLOGAN },
      timeoutMs: WRITE_TIMEOUT_MS,
    });
    expect(revalidateContent).toHaveBeenCalledOnce();
  });

  it('says the text is no longer on the site (404, or a request without a key)', async () => {
    const unknown = 'Этого текста больше нет на сайте — обновите страницу';
    adminRequest.mockResolvedValueOnce(
      failing({
        kind: 'domain',
        status: 404,
        error: 'notFound',
        message: { key: 'admin.siteTexts.errors.unknownKey' },
      }),
    );
    expect(await resetSiteText('zzz.removed')).toEqual({ ok: false, error: unknown });
    adminRequest.mockResolvedValueOnce(
      failing({ kind: 'validation', status: 400, fields: { key: { key: 'admin.siteTexts.errors.unknownKey' } } }),
    );
    expect(await resetSiteText('')).toEqual({ ok: false, error: unknown });
    expect(revalidateContent).not.toHaveBeenCalled();
    expect(markContentStale).not.toHaveBeenCalled();
  });

  it('marks the site stale when the reset may have landed (timeout)', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    adminRequest.mockResolvedValueOnce(failing({ kind: 'unavailable', status: null, reason: 'timeout' }));
    expect(await resetSiteText(SLOGAN)).toEqual({
      ok: false,
      error: 'Не удалось выполнить действие. Попробуйте ещё раз.',
    });
    expect(markContentStale).toHaveBeenCalledOnce();
    expect(revalidateContent).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
