"use server";

import { db } from "@/lib/db";
import { removeStoredFile } from "@/lib/media";
import { revalidateContent } from "@/lib/content/cache";
import { adminAction } from "../action-helpers";
import { actionFail, actionOk, type ActionResult } from "../action-result";
import { getMediaUsages } from "../media-service";
import { idSchema, mediaAltInputSchema } from "../schemas";
import type { LocalizedText } from "@/lib/i18n-text";
import type { DeleteMediaResult, MediaUsage } from "../types";
import { parseInput } from "../validation";

export async function updateMediaAlt(id: string, alt: LocalizedText): Promise<ActionResult<{ alt: LocalizedText }>> {
  return adminAction("updateMediaAlt", async () => {
    const parsed = parseInput(mediaAltInputSchema, { id, alt });
    if (!parsed.success) return actionFail(parsed.message, parsed.fieldErrors);
    await db.media.update({ where: { id: parsed.data.id }, data: { alt: parsed.data.alt }, select: { id: true } });
    revalidateContent();
    return actionOk({ alt: parsed.data.alt }, "Описание сохранено");
  });
}

/**
 * Deletes a media file — only when nothing references it. Otherwise returns the
 * list of places that use it (the UI shows them as links).
 */
export async function deleteMedia(id: string): Promise<DeleteMediaResult> {
  const blocked: { usages: MediaUsage[] | null } = { usages: null };
  const result = await adminAction("deleteMedia", async () => {
    const rowId = idSchema.safeParse(id);
    if (!rowId.success) return actionFail("Некорректный идентификатор");
    const media = await db.media.findUnique({ where: { id: rowId.data }, select: { id: true, path: true } });
    if (!media) return actionFail("Файл не найден — возможно, его уже удалили.");

    const usages = await getMediaUsages(media.id);
    if (usages.length > 0) {
      blocked.usages = usages;
      return actionFail("Файл используется на сайте — сначала замените или уберите его там.");
    }

    // Restrict FKs (gallery, product images) make the DB refuse if a reference appeared meanwhile.
    await db.media.delete({ where: { id: media.id }, select: { id: true } });
    try {
      await removeStoredFile(media.path);
    } catch (error: unknown) {
      console.error(`[admin] media ${media.id} deleted from DB but the file could not be removed:`, error);
    }
    revalidateContent();
    return actionOk(null, "Файл удалён");
  });
  if (!result.ok && blocked.usages) return { ok: false, error: result.error, usages: blocked.usages };
  return result;
}
