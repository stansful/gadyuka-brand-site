"use server";

import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { resendLeadToTelegram } from "@/lib/telegram";
import type { LeadStatus } from "@/generated/prisma/enums";
import { adminAction } from "../action-helpers";
import { actionFail, actionOk, type ActionResult } from "../action-result";
import { LEAD_STATUS_LABELS } from "../labels";
import { idSchema, leadStatusSchema } from "../schemas";

/** Leads are not public content: no cache tag to invalidate, only the admin view is refreshed. */

export async function setLeadStatus(id: string, status: LeadStatus): Promise<ActionResult> {
  return adminAction("setLeadStatus", async () => {
    const rowId = idSchema.safeParse(id);
    const nextStatus = leadStatusSchema.safeParse(status);
    if (!rowId.success || !nextStatus.success) return actionFail("Некорректный запрос");
    await db.lead.update({ where: { id: rowId.data }, data: { status: nextStatus.data }, select: { id: true } });
    refresh();
    return actionOk(null, `Статус: ${LEAD_STATUS_LABELS[nextStatus.data]}`);
  });
}

/** «Отправить в Telegram повторно» — delegates to src/lib/telegram.ts (dry-run in dev/tests). */
export async function resendLead(id: string): Promise<ActionResult> {
  return adminAction("resendLead", async () => {
    const rowId = idSchema.safeParse(id);
    if (!rowId.success) return actionFail("Некорректный запрос");
    const exists = await db.lead.findUnique({ where: { id: rowId.data }, select: { id: true } });
    if (!exists) return actionFail("Заявка не найдена");
    const result = await resendLeadToTelegram(rowId.data);
    refresh();
    if (!result.ok) return actionFail(`Telegram: ${result.error ?? "не удалось отправить"}`);
    return actionOk(null, "Заявка отправлена в Telegram");
  });
}
