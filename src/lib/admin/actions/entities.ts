'use server';

import { revalidateContent } from '@/lib/content/cache';
import { db } from '@/lib/db';

import { adminAction, errorFailure } from '../action-helpers';
import { actionFail, actionOk, type ActionResult } from '../action-result';
import { getAdminTranslations } from '../i18n-server';
import {
  idSchema,
  publishableEntitySchema,
  reorderInputSchema,
  type OrderableEntity,
  type PublishableEntity,
} from '../schemas';
import { parseInput } from '../validation';

/**
 * Generic list operations shared by every entity list (collections … partners, menu items,
 * social links): publish toggle, drag & drop order, delete.
 */

export async function setPublished(entity: PublishableEntity, id: string, published: boolean): Promise<ActionResult> {
  return adminAction('setPublished', async () => {
    const kind = publishableEntitySchema.safeParse(entity);
    const rowId = idSchema.safeParse(id);
    if (!kind.success || !rowId.success || typeof published !== 'boolean') return errorFailure('invalidRequest');
    const where = { id: rowId.data };
    const data = { published };
    switch (kind.data) {
      case 'collection':
        await db.collection.update({ where, data, select: { id: true } });
        break;
      case 'product':
        await db.product.update({ where, data, select: { id: true } });
        break;
      case 'review':
        await db.review.update({ where, data, select: { id: true } });
        break;
      case 'news':
        await db.newsItem.update({ where, data, select: { id: true } });
        break;
      case 'gallery':
        await db.galleryItem.update({ where, data, select: { id: true } });
        break;
      case 'offer':
        await db.offer.update({ where, data, select: { id: true } });
        break;
      case 'partner':
        await db.partner.update({ where, data, select: { id: true } });
        break;
      case 'menuItem':
        await db.menuItem.update({ where, data, select: { id: true } });
        break;
      case 'socialLink':
        await db.socialLink.update({ where, data, select: { id: true } });
        break;
    }
    revalidateContent();
    const t = await getAdminTranslations('admin.entities');
    return actionOk(null, t(published ? 'published' : 'hidden'));
  });
}

/** Persists a drag & drop order: `ids[i]` gets order = i. */
export async function reorderItems(entity: OrderableEntity, ids: string[]): Promise<ActionResult> {
  return adminAction('reorderItems', async () => {
    const t = await getAdminTranslations('admin.entities');
    const parsed = await parseInput(reorderInputSchema, { entity, ids });
    if (!parsed.success) return actionFail(t('invalidOrder'));
    const list = parsed.data.ids;
    switch (parsed.data.entity) {
      case 'collection':
        await db.$transaction(
          list.map((id, order) => db.collection.update({ where: { id }, data: { order }, select: { id: true } })),
        );
        break;
      case 'product':
        await db.$transaction(
          list.map((id, order) => db.product.update({ where: { id }, data: { order }, select: { id: true } })),
        );
        break;
      case 'review':
        await db.$transaction(
          list.map((id, order) => db.review.update({ where: { id }, data: { order }, select: { id: true } })),
        );
        break;
      case 'gallery':
        await db.$transaction(
          list.map((id, order) => db.galleryItem.update({ where: { id }, data: { order }, select: { id: true } })),
        );
        break;
      case 'offer':
        await db.$transaction(
          list.map((id, order) => db.offer.update({ where: { id }, data: { order }, select: { id: true } })),
        );
        break;
      case 'partner':
        await db.$transaction(
          list.map((id, order) => db.partner.update({ where: { id }, data: { order }, select: { id: true } })),
        );
        break;
      case 'menuItem':
        await db.$transaction(
          list.map((id, order) => db.menuItem.update({ where: { id }, data: { order }, select: { id: true } })),
        );
        break;
      case 'socialLink':
        await db.$transaction(
          list.map((id, order) => db.socialLink.update({ where: { id }, data: { order }, select: { id: true } })),
        );
        break;
    }
    revalidateContent();
    return actionOk(null, t('orderSaved'));
  });
}

/**
 * Deletes one row. Media files are NOT deleted (they stay in the media library).
 * A collection is deleted together with its products (onDelete: Cascade).
 */
export async function deleteItem(entity: PublishableEntity, id: string): Promise<ActionResult> {
  return adminAction('deleteItem', async () => {
    const kind = publishableEntitySchema.safeParse(entity);
    const rowId = idSchema.safeParse(id);
    if (!kind.success || !rowId.success) return errorFailure('invalidRequest');
    const where = { id: rowId.data };
    switch (kind.data) {
      case 'collection':
        await db.collection.delete({ where, select: { id: true } });
        break;
      case 'product':
        await db.product.delete({ where, select: { id: true } });
        break;
      case 'review':
        await db.review.delete({ where, select: { id: true } });
        break;
      case 'news':
        await db.newsItem.delete({ where, select: { id: true } });
        break;
      case 'gallery':
        await db.galleryItem.delete({ where, select: { id: true } });
        break;
      case 'offer':
        await db.offer.delete({ where, select: { id: true } });
        break;
      case 'partner':
        await db.partner.delete({ where, select: { id: true } });
        break;
      case 'menuItem':
        await db.menuItem.delete({ where, select: { id: true } });
        break;
      case 'socialLink':
        await db.socialLink.delete({ where, select: { id: true } });
        break;
    }
    revalidateContent();
    const t = await getAdminTranslations('admin.entities');
    return actionOk(null, t(`deleted.${kind.data}`));
  });
}
