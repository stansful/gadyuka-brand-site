import 'server-only';
import type { ContentEntitySaved } from '@shared/contracts/content-entities';

import type { ApiResult } from './api-result';

import { adminRequest } from './admin';

/**
 * Backend calls of the admin's content entities (news, gallery, offers, partners, menu
 * items, social links — /api/v1/admin/…, shared/contracts/content-entities.ts).
 */

/** Admin routes of the content entities ("/api/v1/admin/news" …). */
export type ContentEntityPath = `/api/v1/admin/${string}`;

/** Create (id = null: POST `path`) or update (PUT `path/:id`) a row; answers its id. */
export function saveContentEntity<B>(
  path: ContentEntityPath,
  id: string | null,
  body: B,
): Promise<ApiResult<ContentEntitySaved>> {
  if (id === null) return adminRequest<ContentEntitySaved>(path, { method: 'POST', body });
  return adminRequest<ContentEntitySaved>(`${path}/${encodeURIComponent(id)}`, { method: 'PUT', body });
}
