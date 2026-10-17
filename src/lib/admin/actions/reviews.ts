"use server";

import { db } from "@/lib/db";
import { revalidateContent } from "@/lib/content/cache";
import { adminAction, findMissingMediaIds, MISSING_MEDIA_MESSAGE } from "../action-helpers";
import { actionFail, actionOk, type ActionResult } from "../action-result";
import { idSchema, reviewInputSchema, type ReviewInput } from "../schemas";
import { parseInput } from "../validation";

/** Create (id = null) or update a review. */
export async function saveReview(id: string | null, input: ReviewInput): Promise<ActionResult<{ id: string }>> {
  return adminAction("saveReview", async () => {
    const parsedId = id === null ? null : idSchema.safeParse(id);
    if (parsedId && !parsedId.success) return actionFail("Некорректный идентификатор");
    const parsed = parseInput(reviewInputSchema, input);
    if (!parsed.success) return actionFail(parsed.message, parsed.fieldErrors);
    const data = parsed.data;
    const currentId = parsedId?.data ?? null;

    if ((await findMissingMediaIds([data.avatarId])).length > 0) {
      return actionFail(MISSING_MEDIA_MESSAGE, { avatarId: MISSING_MEDIA_MESSAGE });
    }

    const fields = {
      author: data.author,
      role: data.role,
      text: data.text,
      avatarId: data.avatarId,
      rating: data.rating,
      published: data.published,
    };

    let savedId: string;
    if (currentId) {
      savedId = (await db.review.update({ where: { id: currentId }, data: fields, select: { id: true } })).id;
    } else {
      const last = await db.review.aggregate({ _max: { order: true } });
      savedId = (
        await db.review.create({ data: { ...fields, order: (last._max.order ?? -1) + 1 }, select: { id: true } })
      ).id;
    }
    revalidateContent();
    return actionOk({ id: savedId }, currentId ? "Отзыв сохранён" : "Отзыв добавлен");
  });
}
