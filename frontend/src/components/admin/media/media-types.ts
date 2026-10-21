import type { ActionResult } from '@/lib/admin/action-result';
import type { MediaRef } from '@shared/contracts/common';
import type { MediaItem } from '@shared/contracts/media';

/**
 * View models of the admin media library (isomorphic, types only). The files are the backend's
 * shapes (shared/contracts/media.ts); the places that use a file arrive already translated from the
 * admin's media routes / actions.
 */

/** Enough of a media file to render a thumbnail / picker preview. */
export type AdminMediaRef = MediaRef;

/** A file of the media library. */
export type AdminMedia = MediaItem;

/** A place that uses a file, as the admin shows it: «Фото товара: Худи» linking to its page. */
export type MediaUsageView = {
  /** What references the file (admin.media.usages), e.g. «Фото товара», «Картинка лендинга» */
  kind: string;
  title: string;
  href: string;
};

/** A page of the library (GET /admin/api/media). */
export type MediaPage = { items: AdminMedia[]; nextCursor: string | null };

/** deleteMedia(): blocked deletes carry the places that still use the file. */
export type DeleteMediaResult = ActionResult | { ok: false; error: string; usages: MediaUsageView[] };
