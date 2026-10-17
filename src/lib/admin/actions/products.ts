"use server";

import { db } from "@/lib/db";
import { revalidateContent } from "@/lib/content/cache";
import { adminAction, findMissingMediaIds, MISSING_MEDIA_MESSAGE } from "../action-helpers";
import { actionFail, actionOk, type ActionResult } from "../action-result";
import { idSchema, productInputSchema, type ProductInput } from "../schemas";
import { parseInput } from "../validation";

/** Create (id = null) or update a product together with its ordered images. */
export async function saveProduct(id: string | null, input: ProductInput): Promise<ActionResult<{ id: string }>> {
  return adminAction("saveProduct", async () => {
    const parsedId = id === null ? null : idSchema.safeParse(id);
    if (parsedId && !parsedId.success) return actionFail("Некорректный идентификатор");
    const parsed = parseInput(productInputSchema, input);
    if (!parsed.success) return actionFail(parsed.message, parsed.fieldErrors);
    const data = parsed.data;
    const currentId = parsedId?.data ?? null;

    const [slugTaken, collection, missingMedia] = await Promise.all([
      db.product.findFirst({
        where: { slug: data.slug, ...(currentId ? { NOT: { id: currentId } } : {}) },
        select: { id: true },
      }),
      db.collection.findUnique({ where: { id: data.collectionId }, select: { id: true } }),
      findMissingMediaIds(data.imageIds),
    ]);
    if (slugTaken) return actionFail("Адрес уже занят", { slug: "Товар с таким адресом уже есть" });
    if (!collection) return actionFail("Коллекция не найдена", { collectionId: "Выберите коллекцию" });
    if (missingMedia.length > 0) return actionFail(MISSING_MEDIA_MESSAGE, { imageIds: MISSING_MEDIA_MESSAGE });

    const fields = {
      slug: data.slug,
      collectionId: data.collectionId,
      title: data.title,
      description: data.description,
      details: data.details,
      price: data.price,
      published: data.published,
    };

    const savedId = await db.$transaction(async (tx) => {
      const existing = currentId
        ? await tx.product.findUnique({ where: { id: currentId }, select: { collectionId: true } })
        : null;
      if (currentId && !existing) return null;

      // New product, or moved to another collection → append to the end of that collection.
      const needsOrder = !existing || existing.collectionId !== data.collectionId;
      const order = needsOrder
        ? ((await tx.product.aggregate({ where: { collectionId: data.collectionId }, _max: { order: true } }))._max.order ?? -1) + 1
        : undefined;

      const product = currentId
        ? await tx.product.update({
            where: { id: currentId },
            data: { ...fields, ...(order === undefined ? {} : { order }) },
            select: { id: true },
          })
        : await tx.product.create({ data: { ...fields, order: order ?? 0 }, select: { id: true } });

      await tx.productImage.deleteMany({ where: { productId: product.id, mediaId: { notIn: data.imageIds } } });
      for (const [index, mediaId] of data.imageIds.entries()) {
        await tx.productImage.upsert({
          where: { productId_mediaId: { productId: product.id, mediaId } },
          create: { productId: product.id, mediaId, order: index },
          update: { order: index },
        });
      }
      return product.id;
    });

    if (savedId === null) return actionFail("Товар не найден — возможно, его уже удалили.");

    revalidateContent();
    return actionOk({ id: savedId }, currentId ? "Товар сохранён" : "Товар создан");
  });
}
