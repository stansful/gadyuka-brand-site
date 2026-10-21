import { strictEqual, throws } from 'node:assert';
import { describe, it } from 'node:test';

import { MAX_MEDIA_KEY_LENGTH, MAX_MEDIA_KEY_SEGMENT_LENGTH, MEDIA_URL_PREFIX } from '~core/media/media.constants';
import { UserRole } from '~core/users/user-role';
import { MediaKeys } from '~module/storage';

const keys = new MediaKeys();
const OWNER = '0199f2c4-0000-7000-8000-000000000001';
const UUID = '3f2b8c1e-9a4d-4e7f-8b2a-1c3d5e7f9a0b';

describe('MediaKeys.buildObjectKey', () => {
  it('builds "<role>/<ownerId>/<uuid>/image.webp" with a lowercase role and uuid', () => {
    strictEqual(
      keys.buildObjectKey({ ownerType: UserRole.ADMIN, ownerId: OWNER, uuid: UUID }),
      `admin/${OWNER}/${UUID}/image.webp`,
    );
    strictEqual(
      keys.buildObjectKey({ ownerType: UserRole.USER, ownerId: OWNER, uuid: UUID.toUpperCase() }),
      `user/${OWNER}/${UUID}/image.webp`,
    );
  });

  it('rejects owner ids and uuids that are not a single safe segment', () => {
    for (const ownerId of ['../etc', 'a/b', '']) {
      throws(() => keys.buildObjectKey({ ownerType: UserRole.ADMIN, ownerId, uuid: UUID }), ownerId);
    }
    for (const uuid of ['not-a-uuid', `${UUID}/..`]) {
      throws(() => keys.buildObjectKey({ ownerType: UserRole.ADMIN, ownerId: OWNER, uuid }), uuid);
    }
  });
});

describe('MediaKeys.buildPublicUrl', () => {
  it('prefixes /media and encodes every segment', () => {
    strictEqual(MEDIA_URL_PREFIX, '/media');
    strictEqual(keys.buildPublicUrl(`admin/${OWNER}/${UUID}/image.webp`), `/media/admin/${OWNER}/${UUID}/image.webp`);
    strictEqual(keys.buildPublicUrl('/a b/c?d.webp'), '/media/a%20b/c%3Fd.webp');
  });
});

describe('MediaKeys.findServableKey', () => {
  it('accepts safe keys of raster images', () => {
    strictEqual(keys.findServableKey(`admin/${OWNER}/${UUID}/image.webp`), `admin/${OWNER}/${UUID}/image.webp`);
    strictEqual(keys.findServableKey('a.JPG'), 'a.JPG');
    strictEqual(keys.findServableKey('1/2/3/4/5/6/7/x.png'), '1/2/3/4/5/6/7/x.png');
  });

  it('rejects traversal, hidden segments, odd characters, too many segments and non-images', () => {
    const refused = [
      '',
      '../secret.webp',
      'admin/.hidden.webp',
      '.env',
      'a b.webp',
      'a%2Fb.webp',
      '/a.webp',
      'a//b.webp',
      '1/2/3/4/5/6/7/8/x.png',
      'evil.svg',
      'page.html',
      'admin/folder',
      'webp',
    ];
    for (const path of refused) {
      strictEqual(keys.findServableKey(path), null, path);
    }
  });

  it('rejects names the storage would refuse (a segment over 255 characters, a key over 1024)', () => {
    const longest = `${'a'.repeat(MAX_MEDIA_KEY_SEGMENT_LENGTH - '.webp'.length)}.webp`;
    strictEqual(keys.findServableKey(longest), longest);
    strictEqual(keys.findServableKey(`a${longest}`), null);
    strictEqual(keys.findServableKey(`admin/${'b'.repeat(256)}/image.webp`), null);
    const folders = Array.from({ length: 4 }, () => 'f'.repeat(250)).join('/');
    const fits = `${folders}/${'x'.repeat(MAX_MEDIA_KEY_LENGTH - 4 * 251 - '.webp'.length)}.webp`;
    strictEqual(keys.findServableKey(fits)?.length, MAX_MEDIA_KEY_LENGTH);
    strictEqual(keys.findServableKey(`${folders}/x${fits.slice(folders.length + 1)}`), null);
  });
});

describe('MediaKeys content types', () => {
  it('maps served extensions and recognises allowed stored types', () => {
    strictEqual(keys.contentTypeOf('admin/x/y/image.webp'), 'image/webp');
    strictEqual(keys.contentTypeOf('a/photo.JPEG'), 'image/jpeg');
    strictEqual(keys.isServedContentType('image/webp'), true);
    strictEqual(keys.isServedContentType('IMAGE/PNG; charset=binary'), true);
    strictEqual(keys.isServedContentType('text/html'), false);
    strictEqual(keys.isServedContentType('image/svg+xml'), false);
    strictEqual(keys.isServedContentType(undefined), false);
  });
});
