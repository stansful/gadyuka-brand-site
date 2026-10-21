/**
 * Admin entities with the shared list operations (publish toggle, manual order, delete) —
 * shared/contracts/entities.ts (`PublishableEntityKind`). The values are the URL segment
 * (/api/v1/admin/entities/:kind/…) and the entity names of the frontend's lists.
 */
export enum EntityKind {
  COLLECTION = 'collection',
  PRODUCT = 'product',
  REVIEW = 'review',
  NEWS = 'news',
  GALLERY = 'gallery',
  OFFER = 'offer',
  PARTNER = 'partner',
  MENU_ITEM = 'menuItem',
  SOCIAL_LINK = 'socialLink',
}

/** Entities with a manual order (`order` column): every kind but the news, which are ordered by date. */
export type OrderableEntityKind = Exclude<EntityKind, EntityKind.NEWS>;
