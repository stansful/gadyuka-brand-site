"use server";

import { db } from "@/lib/db";
import { revalidateContent } from "@/lib/content/cache";
import { adminAction, findMissingMediaIds, MISSING_MEDIA_MESSAGE } from "../action-helpers";
import { actionFail, actionOk, type ActionResult } from "../action-result";
import { settingsInputSchema, type SettingsInput } from "../schemas";
import { parseInput } from "../validation";

/** Saves the single SiteSettings row (id = 1): contacts, socials, SEO, OG image. */
export async function saveSettings(input: SettingsInput): Promise<ActionResult> {
  return adminAction("saveSettings", async () => {
    const parsed = parseInput(settingsInputSchema, input);
    if (!parsed.success) return actionFail(parsed.message, parsed.fieldErrors);
    const data = parsed.data;
    if ((await findMissingMediaIds([data.ogImageId])).length > 0) {
      return actionFail(MISSING_MEDIA_MESSAGE, { ogImageId: MISSING_MEDIA_MESSAGE });
    }

    const fields = {
      phone: data.phone,
      email: data.email,
      address: data.address,
      socials: data.socials,
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      ogImageId: data.ogImageId,
    };
    await db.siteSettings.upsert({
      where: { id: 1 },
      create: { id: 1, ...fields },
      update: fields,
      select: { id: true },
    });
    revalidateContent();
    return actionOk(null, "Настройки сохранены");
  });
}
