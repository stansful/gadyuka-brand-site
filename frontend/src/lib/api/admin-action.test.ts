import { describe, expect, it, vi } from 'vitest';

import type { ApiResult } from './api-result';

const revalidateContent = vi.fn();
const markContentStale = vi.fn();
vi.mock('@/lib/content/cache', () => ({ revalidateContent, markContentStale }));
vi.mock('next-intl/server', async () => (await import('../../../test/admin-intl')).nextIntlServerMock);

const { adminApiAction } = await import('./admin-action');
const { actionOk } = await import('@/lib/admin/action-result');

const ok = <T>(data: T): Promise<ApiResult<T>> => Promise.resolve({ ok: true, status: 200, data });
const fail = (failure: Extract<ApiResult<never>, { ok: false }>['failure']): Promise<ApiResult<never>> =>
  Promise.resolve({ ok: false, failure });

describe('adminApiAction (backend results → ActionResult)', () => {
  it('returns onSuccess and refreshes the public cache only when asked', async () => {
    revalidateContent.mockClear();
    const quiet = await adminApiAction('quiet', () => ok({ id: '1' }), { onSuccess: data => actionOk(data.id) });
    expect(quiet).toEqual({ ok: true, data: '1' });
    expect(revalidateContent).not.toHaveBeenCalled();
    await adminApiAction('write', () => ok(null), { revalidatesContent: true, onSuccess: () => actionOk(null) });
    expect(revalidateContent).toHaveBeenCalledOnce();
  });

  it('translates validation fields with their values, and the form error', async () => {
    const result = await adminApiAction(
      'save',
      () =>
        fail({
          kind: 'validation',
          status: 400,
          fields: {
            'title.en': { key: 'admin.validation.tooLong', values: { max: 200 } },
            slug: { key: 'admin.validation.slugFormat' },
            extra: { key: 'admin.validation.unknownField' },
          },
        }),
      { revalidatesContent: true, onSuccess: () => actionOk(null) },
    );
    expect(result).toEqual({
      ok: false,
      error: 'Проверьте поля формы — есть ошибки',
      fieldErrors: {
        'title.en': 'Не длиннее 200 символов',
        slug: 'Только латиница, цифры и дефисы, например: menya-zapomnyat',
        extra: 'Лишнее поле в запросе',
      },
    });
  });

  it('translates domain errors, a lost session and an unreachable backend', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const domain = await adminApiAction(
      'delete',
      () => fail({ kind: 'domain', status: 404, error: 'notFound', message: { key: 'admin.errors.notFound' } }),
      { onSuccess: () => actionOk(null) },
    );
    expect(domain).toEqual({ ok: false, error: 'Запись не найдена — возможно, её уже удалили. Обновите страницу.' });
    const expired = await adminApiAction(
      'delete',
      () =>
        fail({
          kind: 'domain',
          status: 401,
          error: 'accessTokenInvalid',
          message: { key: 'admin.errors.sessionExpired' },
        }),
      { onSuccess: () => actionOk(null) },
    );
    expect(expired).toEqual({ ok: false, error: 'Сессия истекла. Обновите страницу и войдите снова.' });
    const down = await adminApiAction('delete', () => fail({ kind: 'unavailable', status: null, reason: 'network' }), {
      onSuccess: () => actionOk(null),
    });
    const unknown = await adminApiAction(
      'delete',
      () => fail({ kind: 'domain', status: 409, error: 'conflict', message: { key: 'admin.nothing.like.this' } }),
      { onSuccess: () => actionOk(null) },
    );
    expect(down).toEqual({ ok: false, error: 'Не удалось выполнить действие. Попробуйте ещё раз.' });
    expect(unknown).toEqual(down);
  });

  it('marks the site stale when a public write may have landed (lost answer, 5xx, throw), never on a refusal', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    revalidateContent.mockClear();
    markContentStale.mockClear();
    const write = { revalidatesContent: true, onSuccess: () => actionOk(null) } as const;
    const unknownOutcomes = [
      () => fail({ kind: 'unavailable', status: null, reason: 'timeout' }),
      () => fail({ kind: 'unavailable', status: null, reason: 'network' }),
      () => fail({ kind: 'unavailable', status: 502, reason: 'badResponse' }),
      () => fail({ kind: 'domain', status: 500, error: 'internal', message: { key: 'admin.errors.actionFailed' } }),
      () => Promise.reject(new Error('socket hang up')),
    ];
    for (const request of unknownOutcomes) {
      expect(await adminApiAction('save', request, write)).toEqual({
        ok: false,
        error: 'Не удалось выполнить действие. Попробуйте ещё раз.',
      });
    }
    expect(markContentStale).toHaveBeenCalledTimes(unknownOutcomes.length);
    expect(revalidateContent).not.toHaveBeenCalled();

    markContentStale.mockClear();
    await adminApiAction('save', () => fail({ kind: 'unavailable', status: null, reason: 'config' }), write);
    await adminApiAction(
      'save',
      () => fail({ kind: 'domain', status: 409, error: 'conflict', message: { key: 'admin.errors.slugTaken' } }),
      write,
    );
    await adminApiAction('save', () => fail({ kind: 'validation', status: 400, fields: {} }), write);
    await adminApiAction('lead', () => fail({ kind: 'unavailable', status: null, reason: 'timeout' }), {
      onSuccess: () => actionOk(null),
    });
    expect(markContentStale).not.toHaveBeenCalled();
  });
});
