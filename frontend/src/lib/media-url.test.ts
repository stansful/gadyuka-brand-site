import { describe, expect, it } from 'vitest';

import { brandAssetUrl, mediaPublicUrl } from './media-url';

describe('mediaPublicUrl (re-exported from src/lib/storage/keys)', () => {
  it('prefixes /media and encodes segments', () => {
    expect(mediaPublicUrl('admin/u1/3f2b8c1e-9a4d-4e7f-8b2a-1c3d5e7f9a0b/image.webp')).toBe(
      '/media/admin/u1/3f2b8c1e-9a4d-4e7f-8b2a-1c3d5e7f9a0b/image.webp',
    );
    expect(mediaPublicUrl('/seed/a b.webp')).toBe('/media/seed/a%20b.webp');
  });
});

describe('brandAssetUrl', () => {
  it('builds brand asset urls', () => {
    expect(brandAssetUrl('wordmark-ink.svg', {})).toBe('/brand/wordmark-ink.svg');
    expect(brandAssetUrl('/wordmark-ink.svg', {})).toBe('/brand/wordmark-ink.svg');
  });

  it('versions brand asset urls by content hash', () => {
    const versions = { 'wordmark-ink.svg': 'Ab3_-x9Zq0' };
    expect(brandAssetUrl('wordmark-ink.svg', versions)).toBe('/brand/wordmark-ink.svg?v=Ab3_-x9Zq0');
    expect(brandAssetUrl('hood.svg', versions)).toBe('/brand/hood.svg');
  });
});
