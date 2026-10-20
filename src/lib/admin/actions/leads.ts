'use server';

import { refresh } from 'next/cache';

import type { LeadStatus } from '@/generated/prisma/enums';
import { db } from '@/lib/db';
import { resendLeadToTelegram } from '@/lib/telegram';

import { adminAction, errorFailure } from '../action-helpers';
import { actionFail, actionOk, type ActionResult } from '../action-result';
import { getAdminTranslations } from '../i18n-server';
import { idSchema, leadStatusSchema } from '../schemas';

/** Leads are not public content: no cache tag to invalidate, only the admin view is refreshed. */

export async function setLeadStatus(id: string, status: LeadStatus): Promise<ActionResult> {
  return adminAction('setLeadStatus', async () => {
    const rowId = idSchema.safeParse(id);
    const nextStatus = leadStatusSchema.safeParse(status);
    if (!rowId.success || !nextStatus.success) return errorFailure('invalidRequest');
    await db.lead.update({ where: { id: rowId.data }, data: { status: nextStatus.data }, select: { id: true } });
    refresh();
    const t = await getAdminTranslations('admin.leads');
    return actionOk(null, t('statusSaved', { status: t(`statuses.${nextStatus.data}`) }));
  });
}

/** «Отправить в Telegram повторно» — delegates to src/lib/telegram.ts (dry-run in dev/tests). */
export async function resendLead(id: string): Promise<ActionResult> {
  return adminAction('resendLead', async () => {
    const rowId = idSchema.safeParse(id);
    if (!rowId.success) return errorFailure('invalidRequest');
    const t = await getAdminTranslations('admin.leads');
    const exists = await db.lead.findUnique({ where: { id: rowId.data }, select: { id: true } });
    if (!exists) return actionFail(t('notFound'));
    const result = await resendLeadToTelegram(rowId.data);
    refresh();
    if (!result.ok) return actionFail(t('resendFailed', { error: result.error ?? t('resendFailedUnknown') }));
    return actionOk(null, t('resent'));
  });
}
