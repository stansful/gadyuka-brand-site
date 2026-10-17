"use server";

import { db } from "@/lib/db";
import { revalidateContent } from "@/lib/content/cache";
import { adminAction, findMissingMediaIds, MISSING_MEDIA_MESSAGE } from "../action-helpers";
import { actionFail, actionOk, type ActionResult } from "../action-result";
import { idSchema, newsDateFromInput, newsInputSchema, type NewsInput } from "../schemas";
import { parseInput } from "../validation";

/** Create (id = null) or update a news item. News are ordered by date (newest first). */
export async function saveNews(id: string | null, input: NewsInput): Promise<ActionResult<{ id: string }>> {
  return adminAction("saveNews", async () => {
    const parsedId = id === null ? null : idSchema.safeParse(id);
    if (parsedId && !parsedId.success) return actionFail("Некорректный идентификатор");
    const parsed = parseInput(newsInputSchema, input);
    if (!parsed.success) return actionFail(parsed.message, parsed.fieldErrors);
    const data = parsed.data;
    const currentId = parsedId?.data ?? null;

    const slugTaken = await db.newsItem.findFirst({
      where: { slug: data.slug, ...(currentId ? { NOT: { id: currentId } } : {}) },
      select: { id: true },
    });
    if (slugTaken) return actionFail("Адрес уже занят", { slug: "Новость с таким адресом уже есть" });
    if ((await findMissingMediaIds([data.imageId])).length > 0) {
      return actionFail(MISSING_MEDIA_MESSAGE, { imageId: MISSING_MEDIA_MESSAGE });
    }

    const fields = {
      slug: data.slug,
      title: data.title,
      excerpt: data.excerpt,
      body: data.body,
      date: newsDateFromInput(data.date),
      imageId: data.imageId,
      published: data.published,
    };

    const savedId = currentId
      ? (await db.newsItem.update({ where: { id: currentId }, data: fields, select: { id: true } })).id
      : (await db.newsItem.create({ data: fields, select: { id: true } })).id;

    revalidateContent();
    return actionOk({ id: savedId }, currentId ? "Новость сохранена" : "Новость создана");
  });
}
