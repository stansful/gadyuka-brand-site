"use server";

import { db } from "@/lib/db";
import { revalidateContent } from "@/lib/content/cache";
import { adminAction, findMissingMediaIds, MISSING_MEDIA_MESSAGE } from "../action-helpers";
import { actionFail, actionOk, type ActionResult } from "../action-result";
import { galleryInputSchema, idSchema, type GalleryInput } from "../schemas";
import { parseInput } from "../validation";
import { z } from "zod";

/** Create (id = null) or update a gallery item. */
export async function saveGalleryItem(id: string | null, input: GalleryInput): Promise<ActionResult<{ id: string }>> {
  return adminAction("saveGalleryItem", async () => {
    const parsedId = id === null ? null : idSchema.safeParse(id);
    if (parsedId && !parsedId.success) return actionFail("Некорректный идентификатор");
    const parsed = parseInput(galleryInputSchema, input);
    if (!parsed.success) return actionFail(parsed.message, parsed.fieldErrors);
    const data = parsed.data;
    const currentId = parsedId?.data ?? null;

    if ((await findMissingMediaIds([data.mediaId])).length > 0) {
      return actionFail(MISSING_MEDIA_MESSAGE, { mediaId: MISSING_MEDIA_MESSAGE });
    }
    const fields = { mediaId: data.mediaId, caption: data.caption, published: data.published };

    let savedId: string;
    if (currentId) {
      savedId = (await db.galleryItem.update({ where: { id: currentId }, data: fields, select: { id: true } })).id;
    } else {
      const last = await db.galleryItem.aggregate({ _max: { order: true } });
      savedId = (
        await db.galleryItem.create({ data: { ...fields, order: (last._max.order ?? -1) + 1 }, select: { id: true } })
      ).id;
    }
    revalidateContent();
    return actionOk({ id: savedId }, currentId ? "Фото сохранено" : "Фото добавлено в галерею");
  });
}

const bulkGallerySchema = z.object({
  mediaIds: z
    .array(idSchema)
    .min(1, "Выберите фото")
    .max(100, "Не больше 100 фото за раз")
    .refine((ids) => new Set(ids).size === ids.length, "Фото повторяются"),
  published: z.boolean(),
});

/** Adds several media files to the end of the gallery at once (captions can be filled in later). */
export async function addGalleryItems(input: { mediaIds: string[]; published: boolean }): Promise<ActionResult<{ count: number }>> {
  return adminAction("addGalleryItems", async () => {
    const parsed = parseInput(bulkGallerySchema, input);
    if (!parsed.success) return actionFail(parsed.message, parsed.fieldErrors);
    const { mediaIds, published } = parsed.data;
    if ((await findMissingMediaIds(mediaIds)).length > 0) return actionFail(MISSING_MEDIA_MESSAGE);

    const last = await db.galleryItem.aggregate({ _max: { order: true } });
    const start = (last._max.order ?? -1) + 1;
    await db.galleryItem.createMany({
      data: mediaIds.map((mediaId, index) => ({ mediaId, order: start + index, published, caption: {} })),
    });
    revalidateContent();
    return actionOk({ count: mediaIds.length }, `Добавлено фото: ${mediaIds.length}`);
  });
}
