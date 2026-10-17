"use server";

import { db } from "@/lib/db";
import { revalidateContent } from "@/lib/content/cache";
import { adminAction, findMissingMediaIds, MISSING_MEDIA_MESSAGE } from "../action-helpers";
import { actionFail, actionOk, type ActionResult } from "../action-result";
import { endOfDayFromInput, idSchema, offerInputSchema, type OfferInput } from "../schemas";
import { parseInput } from "../validation";

/** Create (id = null) or update a special offer. */
export async function saveOffer(id: string | null, input: OfferInput): Promise<ActionResult<{ id: string }>> {
  return adminAction("saveOffer", async () => {
    const parsedId = id === null ? null : idSchema.safeParse(id);
    if (parsedId && !parsedId.success) return actionFail("Некорректный идентификатор");
    const parsed = parseInput(offerInputSchema, input);
    if (!parsed.success) return actionFail(parsed.message, parsed.fieldErrors);
    const data = parsed.data;
    const currentId = parsedId?.data ?? null;

    if ((await findMissingMediaIds([data.imageId])).length > 0) {
      return actionFail(MISSING_MEDIA_MESSAGE, { imageId: MISSING_MEDIA_MESSAGE });
    }
    const hasLabel = Object.keys(data.ctaLabel).length > 0;
    if (hasLabel && !data.ctaHref) {
      return actionFail("Укажите ссылку для кнопки", { ctaHref: "Кнопке нужна ссылка (или очистите подпись кнопки)" });
    }

    const fields = {
      title: data.title,
      text: data.text,
      badge: data.badge,
      ctaLabel: data.ctaLabel,
      ctaHref: data.ctaHref && data.ctaHref.length > 0 ? data.ctaHref : null,
      validUntil: data.validUntil ? endOfDayFromInput(data.validUntil) : null,
      imageId: data.imageId,
      published: data.published,
    };

    let savedId: string;
    if (currentId) {
      savedId = (await db.offer.update({ where: { id: currentId }, data: fields, select: { id: true } })).id;
    } else {
      const last = await db.offer.aggregate({ _max: { order: true } });
      savedId = (
        await db.offer.create({ data: { ...fields, order: (last._max.order ?? -1) + 1 }, select: { id: true } })
      ).id;
    }
    revalidateContent();
    return actionOk({ id: savedId }, currentId ? "Предложение сохранено" : "Предложение создано");
  });
}
