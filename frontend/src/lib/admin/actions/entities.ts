'use server';

import { deleteEntity, reorderEntities, setEntityPublished } from '@/lib/api/entities';
import type { OrderableEntityKind, PublishableEntityKind } from '@shared/contracts/entities';

import type { ActionResult } from '../action-result';

/**
 * Generic list operations shared by every entity list (collections … partners, menu items, social
 * links): publish toggle, drag & drop order, delete — the backend's /api/v1/admin/entities/*
 * (src/lib/api/entities.ts: session check, toasts, refresh of the public site's cache).
 */

export async function setPublished(
  entity: PublishableEntityKind,
  id: string,
  published: boolean,
): Promise<ActionResult> {
  return setEntityPublished(entity, id, published);
}

/** Persists a drag & drop order: `ids[i]` gets order = i. */
export async function reorderItems(entity: OrderableEntityKind, ids: string[]): Promise<ActionResult> {
  return reorderEntities(entity, ids);
}

/**
 * Deletes one row. Media files are NOT deleted (they stay in the media library).
 * A collection is deleted together with its products.
 */
export async function deleteItem(entity: PublishableEntityKind, id: string): Promise<ActionResult> {
  return deleteEntity(entity, id);
}
