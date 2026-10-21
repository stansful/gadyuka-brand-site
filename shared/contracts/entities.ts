/**
 * Shared list operations of the admin (/api/v1/admin/entities/*): publish toggle, drag & drop order
 * and delete of every orderable / publishable entity. Owner: the step 4A foundation.
 *
 * - PATCH  /admin/entities/:kind/:id/published  EntityPublishedRequest → 200 EntityPublishedResponse
 * - POST   /admin/entities/:kind/reorder        EntityOrderRequest     → 204 (`ids[i]` gets order i)
 * - DELETE /admin/entities/:kind/:id                                    → 204 (media files stay)
 *
 * Errors: 400 validation (kind: admin.errors.invalidRequest, id / ids.N: admin.validation.idInvalid,
 * ids: admin.entities.invalidOrder | admin.validation.listDuplicate, published: admin.validation.invalid);
 * 404 notFound (admin.errors.notFound) for an unknown row (reorder: any of the ids); 400 badRequest
 * admin.entities.invalidOrder for products of different collections in one reorder; 409 conflict
 * (admin.errors.related) when other rows still reference the deleted one.
 */

import type { Uuid } from './common';

/** Entities with a `published` flag. */
export type PublishableEntityKind =
  | 'collection'
  | 'product'
  | 'review'
  | 'news'
  | 'gallery'
  | 'offer'
  | 'partner'
  | 'menuItem'
  | 'socialLink';

/** Entities with a manual order (news are ordered by date). Products are ordered within their collection. */
export type OrderableEntityKind = Exclude<PublishableEntityKind, 'news'>;

/** PATCH /admin/entities/:kind/:id/published */
export interface EntityPublishedRequest {
  readonly published: boolean;
}

export interface EntityPublishedResponse {
  readonly id: Uuid;
  readonly published: boolean;
}

/** POST /admin/entities/:kind/reorder — every id once (1…1000 ids). */
export interface EntityOrderRequest {
  readonly ids: readonly Uuid[];
}
