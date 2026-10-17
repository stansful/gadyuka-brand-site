"use server";

import { db } from "@/lib/db";
import { revalidateContent } from "@/lib/content/cache";
import { adminAction, findMissingMediaIds, MISSING_MEDIA_MESSAGE } from "../action-helpers";
import { actionFail, actionOk, type ActionResult } from "../action-result";
import { collectionInputSchema, idSchema, type CollectionInput } from "../schemas";
import { parseInput } from "../validation";

/** Create (id = null) or update a collection. */
export async function saveCollection(id: string | null, input: CollectionInput): Promise<ActionResult<{ id: string }>> {
  return adminAction("saveCollection", async () => {
    const parsedId = id === null ? null : idSchema.safeParse(id);
    if (parsedId && !parsedId.success) return actionFail("Некорректный идентификатор");
    const parsed = parseInput(collectionInputSchema, input);
    if (!parsed.success) return actionFail(parsed.message, parsed.fieldErrors);
    const data = parsed.data;
    const currentId = parsedId?.data ?? null;

    const slugTaken = await db.collection.findFirst({
      where: { slug: data.slug, ...(currentId ? { NOT: { id: currentId } } : {}) },
      select: { id: true },
    });
    if (slugTaken) return actionFail("Адрес уже занят", { slug: "Коллекция с таким адресом уже есть" });
    if ((await findMissingMediaIds([data.coverId])).length > 0) {
      return actionFail(MISSING_MEDIA_MESSAGE, { coverId: MISSING_MEDIA_MESSAGE });
    }

    const fields = {
      slug: data.slug,
      title: data.title,
      description: data.description,
      coverId: data.coverId,
      published: data.published,
    };

    let savedId: string;
    if (currentId) {
      const row = await db.collection.update({ where: { id: currentId }, data: fields, select: { id: true } });
      savedId = row.id;
    } else {
      const last = await db.collection.aggregate({ _max: { order: true } });
      const row = await db.collection.create({
        data: { ...fields, order: (last._max.order ?? -1) + 1 },
        select: { id: true },
      });
      savedId = row.id;
    }
    revalidateContent();
    return actionOk({ id: savedId }, currentId ? "Коллекция сохранена" : "Коллекция создана");
  });
}
