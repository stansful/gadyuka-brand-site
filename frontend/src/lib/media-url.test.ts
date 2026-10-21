import { describe, expect, it } from 'vitest';

import { brandAssetUrl } from './media-url';

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
