import { describe, expect, it } from 'vitest';

import {
  isServedMediaContentType,
  MAX_MEDIA_KEY_LENGTH,
  MAX_MEDIA_KEY_SEGMENT_LENGTH,
  MEDIA_URL_PREFIX,
  mediaContentTypeForKey,
  mediaObjectKey,
  mediaPublicUrl,
  parseMediaKey,
} from './keys';

const OWNER = 'cmh1x2y3z0000abcd1234efgh';
const UUID = '3f2b8c1e-9a4d-4e7f-8b2a-1c3d5e7f9a0b';

describe('mediaObjectKey', () => {
  it('builds "<role>/<ownerId>/<uuid>/image.webp" with a lowercase role and uuid', () => {
    expect(mediaObjectKey({ ownerType: 'ADMIN', ownerId: OWNER, uuid: UUID })).toBe(
      `admin/${OWNER}/${UUID}/image.webp`,
    );
    expect(mediaObjectKey({ ownerType: 'USER', ownerId: OWNER, uuid: UUID.toUpperCase() })).toBe(
      `user/${OWNER}/${UUID}/image.webp`,
    );
  });

  it('rejects owner ids and uuids that are not a single safe segment', () => {
    expect(() => mediaObjectKey({ ownerType: 'ADMIN', ownerId: '../etc', uuid: UUID })).toThrow();
    expect(() => mediaObjectKey({ ownerType: 'ADMIN', ownerId: 'a/b', uuid: UUID })).toThrow();
    expect(() => mediaObjectKey({ ownerType: 'ADMIN', ownerId: '', uuid: UUID })).toThrow();
    expect(() => mediaObjectKey({ ownerType: 'ADMIN', ownerId: OWNER, uuid: 'not-a-uuid' })).toThrow();
    expect(() => mediaObjectKey({ ownerType: 'ADMIN', ownerId: OWNER, uuid: `${UUID}/..` })).toThrow();
  });
});

describe('mediaPublicUrl', () => {
  it('prefixes /media and encodes every segment', () => {
    expect(MEDIA_URL_PREFIX).toBe('/media');
    expect(mediaPublicUrl(`admin/${OWNER}/${UUID}/image.webp`)).toBe(`/media/admin/${OWNER}/${UUID}/image.webp`);
    expect(mediaPublicUrl('/a b/c?d.webp')).toBe('/media/a%20b/c%3Fd.webp');
  });
});

describe('parseMediaKey', () => {
  it('accepts safe keys of raster images', () => {
    expect(parseMediaKey(['admin', OWNER, UUID, 'image.webp'])).toBe(`admin/${OWNER}/${UUID}/image.webp`);
    expect(parseMediaKey(['a.JPG'])).toBe('a.JPG');
    expect(parseMediaKey(['1', '2', '3', '4', '5', '6', '7', 'x.png'])).toBe('1/2/3/4/5/6/7/x.png');
  });

  it('rejects traversal, hidden segments, odd characters, too many segments and non-images', () => {
    expect(parseMediaKey([])).toBeNull();
    expect(parseMediaKey(['..', 'secret.webp'])).toBeNull();
    expect(parseMediaKey(['admin', '.hidden.webp'])).toBeNull();
    expect(parseMediaKey(['.env'])).toBeNull();
    expect(parseMediaKey(['a b.webp'])).toBeNull();
    expect(parseMediaKey(['a/b.webp'])).toBeNull();
    expect(parseMediaKey(['a%2Fb.webp'])).toBeNull();
    expect(parseMediaKey(['', 'a.webp'])).toBeNull();
    expect(parseMediaKey(['1', '2', '3', '4', '5', '6', '7', '8', 'x.png'])).toBeNull();
    expect(parseMediaKey(['evil.svg'])).toBeNull();
    expect(parseMediaKey(['page.html'])).toBeNull();
    expect(parseMediaKey(['admin', 'folder'])).toBeNull();
    expect(parseMediaKey(['webp'])).toBeNull();
  });

  it('rejects names the storage would refuse (a segment over 255 characters, a key over 1024)', () => {
    // MinIO answers 400 XMinioInvalidObjectName to a longer segment, S3 rejects longer keys.
    const longest = `${'a'.repeat(MAX_MEDIA_KEY_SEGMENT_LENGTH - '.webp'.length)}.webp`;
    expect(parseMediaKey([longest])).toBe(longest);
    expect(parseMediaKey([`a${longest}`])).toBeNull();
    expect(parseMediaKey([`${'a'.repeat(300)}.webp`])).toBeNull();
    expect(parseMediaKey(['admin', 'b'.repeat(256), 'image.webp'])).toBeNull();

    const folders = Array.from({ length: 4 }, () => 'f'.repeat(250));
    const fits = [...folders, `${'x'.repeat(MAX_MEDIA_KEY_LENGTH - 4 * 251 - '.webp'.length)}.webp`];
    expect(parseMediaKey(fits)?.length).toBe(MAX_MEDIA_KEY_LENGTH);
    expect(parseMediaKey([...folders, `x${fits[4] ?? ''}`])).toBeNull();
    expect(parseMediaKey([...folders, 'f'.repeat(250), 'image.webp'])).toBeNull();
  });
});

describe('media content types', () => {
  it('maps served extensions and recognises allowed stored types', () => {
    expect(mediaContentTypeForKey('admin/x/y/image.webp')).toBe('image/webp');
    expect(mediaContentTypeForKey('a/photo.JPEG')).toBe('image/jpeg');
    expect(isServedMediaContentType('image/webp')).toBe(true);
    expect(isServedMediaContentType('IMAGE/PNG; charset=binary')).toBe(true);
    expect(isServedMediaContentType('text/html')).toBe(false);
    expect(isServedMediaContentType('image/svg+xml')).toBe(false);
    expect(isServedMediaContentType(undefined)).toBe(false);
  });
});
