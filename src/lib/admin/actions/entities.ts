"use server";

import { db } from "@/lib/db";
import { revalidateContent } from "@/lib/content/cache";
import { adminAction } from "../action-helpers";
import { actionFail, actionOk, type ActionResult } from "../action-result";
import {
  idSchema,
  publishableEntitySchema,
  reorderInputSchema,
  type OrderableEntity,
  type PublishableEntity,
} from "../schemas";
import { parseInput } from "../validation";

/** Generic list operations shared by every entity list: publish toggle, drag & drop order, delete. */

export async function setPublished(entity: PublishableEntity, id: string, published: boolean): Promise<ActionResult> {
  return adminAction("setPublished", async () => {
    const kind = publishableEntitySchema.safeParse(entity);
    const rowId = idSchema.safeParse(id);
    if (!kind.success || !rowId.success || typeof published !== "boolean") return actionFail("Некорректный запрос");
    const where = { id: rowId.data };
    const data = { published };
    switch (kind.data) {
      case "collection":
        await db.collection.update({ where, data, select: { id: true } });
        break;
      case "product":
        await db.product.update({ where, data, select: { id: true } });
        break;
      case "review":
        await db.review.update({ where, data, select: { id: true } });
        break;
      case "news":
        await db.newsItem.update({ where, data, select: { id: true } });
        break;
      case "gallery":
        await db.galleryItem.update({ where, data, select: { id: true } });
        break;
      case "offer":
        await db.offer.update({ where, data, select: { id: true } });
        break;
      case "partner":
        await db.partner.update({ where, data, select: { id: true } });
        break;
    }
    revalidateContent();
    return actionOk(null, published ? "Опубликовано" : "Скрыто с сайта");
  });
}

/** Persists a drag & drop order: `ids[i]` gets order = i. */
export async function reorderItems(entity: OrderableEntity, ids: string[]): Promise<ActionResult> {
  return adminAction("reorderItems", async () => {
    const parsed = parseInput(reorderInputSchema, { entity, ids });
    if (!parsed.success) return actionFail("Некорректный порядок");
    const list = parsed.data.ids;
    switch (parsed.data.entity) {
      case "collection":
        await db.$transaction(list.map((id, order) => db.collection.update({ where: { id }, data: { order }, select: { id: true } })));
        break;
      case "product":
        await db.$transaction(list.map((id, order) => db.product.update({ where: { id }, data: { order }, select: { id: true } })));
        break;
      case "review":
        await db.$transaction(list.map((id, order) => db.review.update({ where: { id }, data: { order }, select: { id: true } })));
        break;
      case "gallery":
        await db.$transaction(list.map((id, order) => db.galleryItem.update({ where: { id }, data: { order }, select: { id: true } })));
        break;
      case "offer":
        await db.$transaction(list.map((id, order) => db.offer.update({ where: { id }, data: { order }, select: { id: true } })));
        break;
      case "partner":
        await db.$transaction(list.map((id, order) => db.partner.update({ where: { id }, data: { order }, select: { id: true } })));
        break;
    }
    revalidateContent();
    return actionOk(null, "Порядок сохранён");
  });
}

/**
 * Deletes one row. Media files are NOT deleted (they stay in the media library).
 * A collection is deleted together with its products (onDelete: Cascade).
 */
export async function deleteItem(entity: PublishableEntity, id: string): Promise<ActionResult> {
  return adminAction("deleteItem", async () => {
    const kind = publishableEntitySchema.safeParse(entity);
    const rowId = idSchema.safeParse(id);
    if (!kind.success || !rowId.success) return actionFail("Некорректный запрос");
    const where = { id: rowId.data };
    let message: string;
    switch (kind.data) {
      case "collection":
        await db.collection.delete({ where, select: { id: true } });
        message = "Коллекция удалена";
        break;
      case "product":
        await db.product.delete({ where, select: { id: true } });
        message = "Товар удалён";
        break;
      case "review":
        await db.review.delete({ where, select: { id: true } });
        message = "Отзыв удалён";
        break;
      case "news":
        await db.newsItem.delete({ where, select: { id: true } });
        message = "Новость удалена";
        break;
      case "gallery":
        await db.galleryItem.delete({ where, select: { id: true } });
        message = "Фото убрано из галереи";
        break;
      case "offer":
        await db.offer.delete({ where, select: { id: true } });
        message = "Предложение удалено";
        break;
      case "partner":
        await db.partner.delete({ where, select: { id: true } });
        message = "Партнёр удалён";
        break;
    }
    revalidateContent();
    return actionOk(null, message);
  });
}
