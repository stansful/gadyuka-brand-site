import { Injectable } from '@nestjs/common';

import {
  MAX_MEDIA_KEY_LENGTH,
  MAX_MEDIA_KEY_SEGMENTS,
  MAX_MEDIA_KEY_SEGMENT_LENGTH,
  MEDIA_CONTENT_TYPES,
  MEDIA_FILE_NAME,
  MEDIA_URL_PREFIX,
} from '~core/media/media.constants';
import { UserRole } from '~core/users/user-role';

import { InvalidMediaKeyError } from './invalid-media-key.error';

export interface MediaKeyParts {
  /** Owner's role — the first key segment, lowercased ("admin" / "user") */
  readonly ownerType: UserRole;
  /** User.id of the owner */
  readonly ownerId: string;
  /** Media.uuid: the per-upload folder */
  readonly uuid: string;
}

/**
 * Media object keys and public URLs (port of the frontend's src/lib/storage/keys.ts):
 * key = "<admin|user>/<ownerId>/<uuid>/image.webp", URL = "/media/<key>".
 */
@Injectable()
export class MediaKeys {
  private static readonly SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;
  /** User.id (uuid) or any other id that is a single safe path segment. */
  private static readonly OWNER_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
  /** RFC 4122 shape, lowercase (Postgres prints uuid in lowercase — the key CHECK compares text). */
  private static readonly UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  private static readonly ROLE_SEGMENTS: Readonly<Record<UserRole, string>> = {
    [UserRole.ADMIN]: 'admin',
    [UserRole.USER]: 'user',
  };

  /** { ADMIN, "0199…", "3f2b…" } → "admin/0199…/3f2b…/image.webp". Throws on an unsafe owner id or uuid. */
  buildObjectKey({ ownerType, ownerId, uuid }: MediaKeyParts): string {
    const folder = uuid.toLowerCase();
    if (!MediaKeys.OWNER_ID.test(ownerId)) {
      throw new InvalidMediaKeyError('owner id');
    }
    if (!MediaKeys.UUID.test(folder)) {
      throw new InvalidMediaKeyError('uuid');
    }
    return `${MediaKeys.ROLE_SEGMENTS[ownerType]}/${ownerId}/${folder}/${MEDIA_FILE_NAME}`;
  }

  /** "admin/…/image.webp" → "/media/admin/…/image.webp" (each segment URI-encoded). */
  buildPublicUrl(key: string): string {
    const encoded = this.segmentsOf(key.replace(/\\/g, '/'))
      .map(segment => encodeURIComponent(segment))
      .join('/');
    return `${MEDIA_URL_PREFIX}/${encoded}`;
  }

  /**
   * The object key of a /media/<path> request, or null: 1..8 segments of [A-Za-z0-9._-] (no "..",
   * no hidden or empty segments) of at most 255 characters, at most 1024 in all, ending in a served
   * raster image extension. Nothing else is ever looked up in the bucket.
   */
  findServableKey(path: string): string | null {
    const segments = path.split('/');
    if (segments.length > MAX_MEDIA_KEY_SEGMENTS || !segments.every(segment => this.isSafeSegment(segment))) {
      return null;
    }
    if (!this.hasServedExtension(segments[segments.length - 1] ?? '')) {
      return null;
    }
    return path.length > MAX_MEDIA_KEY_LENGTH ? null : path;
  }

  /** Content type of a served key by its extension. */
  contentTypeOf(key: string): string {
    return MEDIA_CONTENT_TYPES[this.extensionOf(key.slice(key.lastIndexOf('/') + 1))] ?? 'application/octet-stream';
  }

  /** True for a content type GET /media/* may send as is (an allowed raster image type). */
  isServedContentType(value: string | undefined): boolean {
    const type = (value ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
    return Object.values(MEDIA_CONTENT_TYPES).includes(type);
  }

  private isSafeSegment(segment: string): boolean {
    return (
      segment.length <= MAX_MEDIA_KEY_SEGMENT_LENGTH && MediaKeys.SAFE_SEGMENT.test(segment) && !segment.startsWith('.')
    );
  }

  private hasServedExtension(fileName: string): boolean {
    return MEDIA_CONTENT_TYPES[this.extensionOf(fileName)] !== undefined;
  }

  /** Lowercase extension ("image.WEBP" → "webp"), "" when there is none. */
  private extensionOf(fileName: string): string {
    const dot = fileName.lastIndexOf('.');
    return dot > 0 ? fileName.slice(dot + 1).toLowerCase() : '';
  }

  private segmentsOf(key: string): string[] {
    return key.split('/').filter(segment => segment.length > 0);
  }
}
