import { describe, expect, it, vi } from 'vitest';

import type { MediaUsage } from '@shared/contracts/media';

vi.mock('next-intl/server', async () => (await import('../../../test/admin-intl')).nextIntlServerMock);

const { translateMediaUsages } = await import('./media-usages');

function usage(overrides: Partial<MediaUsage> & Pick<MediaUsage, 'kind'>): MediaUsage {
  return { href: '/admin/x', title: '', contentKey: null, ...overrides };
}

describe('translateMediaUsages', () => {
  it('names each place by its kind and stored title, keeping the admin link', async () => {
    const views = await translateMediaUsages([
      usage({ kind: 'productPhoto', title: 'Худи', href: '/admin/products/p1' }),
      usage({ kind: 'collectionCover', title: 'Меня запомнят' }),
      usage({ kind: 'reviewAvatar', title: 'Анна' }),
      usage({ kind: 'partnerLogo', title: 'Ателье' }),
    ]);
    expect(views).toEqual([
      { kind: 'Фото товара', title: 'Худи', href: '/admin/products/p1' },
      { kind: 'Обложка коллекции', title: 'Меня запомнят', href: '/admin/x' },
      { kind: 'Аватар отзыва', title: 'Анна', href: '/admin/x' },
      { kind: 'Логотип партнёра', title: 'Ателье', href: '/admin/x' },
    ]);
  });

  it('fills in the names of untitled places: gallery photo, settings, landing images', async () => {
    const views = await translateMediaUsages([
      usage({ kind: 'gallery' }),
      usage({ kind: 'gallery', title: 'Показ' }),
      usage({ kind: 'settings', href: '/admin/settings' }),
      usage({ kind: 'landingImage', contentKey: 'about.image', href: '/admin/content?section=about' }),
      usage({ kind: 'landingImage', contentKey: 'old.picture' }),
    ]);
    expect(views.map(view => [view.kind, view.title])).toEqual([
      ['Галерея', 'Фото галереи'],
      ['Галерея', 'Показ'],
      ['Настройки', 'OG-картинка для соцсетей'],
      ['Картинка лендинга', 'О нас — Фото'],
      ['Картинка лендинга', 'old.picture'],
    ]);
  });
});
