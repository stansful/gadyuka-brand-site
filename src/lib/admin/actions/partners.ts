"use server";

import { db } from "@/lib/db";
import { revalidateContent } from "@/lib/content/cache";
import { adminAction, findMissingMediaIds, MISSING_MEDIA_MESSAGE } from "../action-helpers";
import { actionFail, actionOk, type ActionResult } from "../action-result";
import { idSchema, partnerInputSchema, type PartnerInput } from "../schemas";
import { parseInput } from "../validation";

/** Create (id = null) or update a partner. */
export async function savePartner(id: string | null, input: PartnerInput): Promise<ActionResult<{ id: string }>> {
  return adminAction("savePartner", async () => {
    const parsedId = id === null ? null : idSchema.safeParse(id);
    if (parsedId && !parsedId.success) return actionFail("Некорректный идентификатор");
    const parsed = parseInput(partnerInputSchema, input);
    if (!parsed.success) return actionFail(parsed.message, parsed.fieldErrors);
    const data = parsed.data;
    const currentId = parsedId?.data ?? null;

    if ((await findMissingMediaIds([data.logoId])).length > 0) {
      return actionFail(MISSING_MEDIA_MESSAGE, { logoId: MISSING_MEDIA_MESSAGE });
    }
    const fields = {
      name: data.name,
      url: data.url,
      logoId: data.logoId,
      description: data.description,
      published: data.published,
    };

    let savedId: string;
    if (currentId) {
      savedId = (await db.partner.update({ where: { id: currentId }, data: fields, select: { id: true } })).id;
    } else {
      const last = await db.partner.aggregate({ _max: { order: true } });
      savedId = (
        await db.partner.create({ data: { ...fields, order: (last._max.order ?? -1) + 1 }, select: { id: true } })
      ).id;
    }
    revalidateContent();
    return actionOk({ id: savedId }, currentId ? "Партнёр сохранён" : "Партнёр добавлен");
  });
}
