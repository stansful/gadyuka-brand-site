import { getTranslations } from 'next-intl/server';
import { describe, expect, it, vi } from 'vitest';

import { adminPageMetadata, getAdminTranslations } from './i18n-server';

vi.mock('next-intl/server', () => ({ getTranslations: vi.fn() }));

describe('getAdminTranslations', () => {
  it('translates the admin namespace from the bundled copy, without next-intl’s request config', async () => {
    const t = await getAdminTranslations('admin.errors');
    expect(t('invalidId')).toBe('Некорректный идентификатор');
    expect(t('actionFailed')).toBe('Не удалось выполнить действие. Попробуйте ещё раз.');
    // The request config would read the site messages from the backend: the admin never needs them.
    expect(vi.mocked(getTranslations)).not.toHaveBeenCalled();
  });

  it('builds page metadata from an admin key', async () => {
    await expect(adminPageMetadata('collections.title')).resolves.toEqual({ title: 'Коллекции' });
  });
});
