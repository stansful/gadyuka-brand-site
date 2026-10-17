"use server";

import { db } from "@/lib/db";
import { revalidateContent } from "@/lib/content/cache";
import { defaultLocale } from "@/i18n/locales";
import { CONTENT_BLOCKS, contentKeyOrder, isContentKey, isRequiredKey } from "@/lib/content/registry";
import { adminAction, findMissingMediaIds, MISSING_MEDIA_MESSAGE } from "../action-helpers";
import { actionFail, actionOk, type ActionResult, type FieldErrors } from "../action-result";
import { contentSectionInputSchema, type ContentSectionInput } from "../schemas";
import { parseInput } from "../validation";

/** Shown on the Russian tab of a required block (heading, menu item, button) left empty. */
const REQUIRED_BLOCK_MESSAGE = "Обязательное поле: без текста на русском заголовок или кнопка на сайте останутся пустыми";

/**
 * Saves all blocks of one landing section. Keys must belong to that section in the
 * registry (src/lib/content/registry.ts); text blocks store LocalizedText, image
 * blocks store a media reference. Rows missing in the DB are created. Required blocks
 * (registry `required`) need text in the default locale.
 */
export async function saveContentSection(input: ContentSectionInput): Promise<ActionResult<{ saved: number }>> {
  return adminAction("saveContentSection", async () => {
    const parsed = parseInput(contentSectionInputSchema, input);
    if (!parsed.success) return actionFail(parsed.message, parsed.fieldErrors);
    const { section, blocks } = parsed.data;

    const fieldErrors: FieldErrors = {};
    for (const block of blocks) {
      if (!isContentKey(block.key) || CONTENT_BLOCKS[block.key].section !== section) {
        fieldErrors[block.key] = "Блок не относится к этому разделу";
      }
    }
    if (Object.keys(fieldErrors).length > 0) return actionFail("Некорректные блоки", fieldErrors);

    for (const block of blocks) {
      if (!isContentKey(block.key) || CONTENT_BLOCKS[block.key].kind === "IMAGE" || !isRequiredKey(block.key)) continue;
      if (!block.value?.[defaultLocale]) fieldErrors[`${block.key}.${defaultLocale}`] = REQUIRED_BLOCK_MESSAGE;
    }
    if (Object.keys(fieldErrors).length > 0) return actionFail("Заполните обязательные поля", fieldErrors);

    const missingMedia = await findMissingMediaIds(blocks.map((block) => block.mediaId));
    if (missingMedia.length > 0) {
      for (const block of blocks) {
        if (block.mediaId && missingMedia.includes(block.mediaId)) fieldErrors[block.key] = MISSING_MEDIA_MESSAGE;
      }
      return actionFail(MISSING_MEDIA_MESSAGE, fieldErrors);
    }

    const writes = blocks.flatMap((block) => {
      if (!isContentKey(block.key)) return [];
      const definition = CONTENT_BLOCKS[block.key];
      const structure = { section: definition.section, kind: definition.kind, order: contentKeyOrder(block.key) };
      if (definition.kind === "IMAGE") {
        const mediaId = block.mediaId ?? null;
        return [
          db.contentBlock.upsert({
            where: { key: block.key },
            create: { key: block.key, ...structure, mediaId },
            update: { ...structure, mediaId },
            select: { key: true },
          }),
        ];
      }
      const value = block.value ?? {};
      return [
        db.contentBlock.upsert({
          where: { key: block.key },
          create: { key: block.key, ...structure, value },
          update: { ...structure, value },
          select: { key: true },
        }),
      ];
    });

    await db.$transaction(writes);
    revalidateContent();
    return actionOk({ saved: writes.length }, "Тексты раздела сохранены — сайт обновлён");
  });
}
