import { getTranslations } from 'next-intl/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { adminPageMetadata, getAdminTranslations } from './i18n-server';

vi.mock('next-intl/server', async () => {
  const { nextIntlServerMock } = await import('../../../test/admin-intl');
  return { getTranslations: vi.fn(nextIntlServerMock.getTranslations) };
});

describe('getAdminTranslations', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the admin namespace through next-intl with the admin locale', async () => {
    const t = await getAdminTranslations('admin.errors');
    expect(t('invalidId')).toBe('Некорректный идентификатор');
    expect(vi.mocked(getTranslations)).toHaveBeenLastCalledWith({ locale: 'ru', namespace: 'admin.errors' });
  });

  it('falls back to the bundled admin copy when the request config fails (e.g. the DB is down)', async () => {
    vi.mocked(getTranslations).mockRejectedValueOnce(new Error('database unavailable'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const t = await getAdminTranslations('admin.errors');
    expect(t('actionFailed')).toBe('Не удалось выполнить действие. Попробуйте ещё раз.');
    expect(error).toHaveBeenCalledOnce();
  });

  it('builds page metadata from an admin key', async () => {
    await expect(adminPageMetadata('collections.title')).resolves.toEqual({ title: 'Коллекции' });
  });
});
