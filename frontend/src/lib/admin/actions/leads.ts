'use server';

import { refresh } from 'next/cache';

import { adminApiAction } from '@/lib/api/admin-action';
import type { ApiResult } from '@/lib/api/api-result';
import { resendLeadToTelegram, saveLeadStatus } from '@/lib/api/leads';
import type { LeadStatus } from '@shared/contracts/leads';

import { actionFail, actionOk, type ActionResult } from '../action-result';
import { getAdminTranslations } from '../i18n-server';

/**
 * Lead status and the Telegram re-send, through the backend (/api/v1/admin/leads/:id/…). Leads are
 * not public content: no cache tag to invalidate, only the admin view is refreshed.
 */

export async function setLeadStatus(id: string, status: LeadStatus): Promise<ActionResult> {
  return adminApiAction('setLeadStatus', () => asInvalidRequest(saveLeadStatus(id, status)), {
    onSuccess: async data => {
      refresh();
      const t = await getAdminTranslations('admin.leads');
      return actionOk(null, t('statusSaved', { status: t(`statuses.${data.status}`) }));
    },
  });
}

/** «Отправить в Telegram повторно» — the backend sends it (dry run in dev / tests) and stores the outcome. */
export async function resendLead(id: string): Promise<ActionResult> {
  return adminApiAction('resendLead', () => asInvalidRequest(resendLeadToTelegram(id)), {
    onSuccess: async data => {
      refresh();
      const t = await getAdminTranslations('admin.leads');
      if (data.telegramSent) return actionOk(null, t('resent'));
      return actionFail(t('resendFailed', { error: data.telegramError ?? t('resendFailedUnknown') }));
    },
  });
}

/**
 * These actions have no form: a request the backend refuses as invalid (a stale or tampered id or
 * status) shows «Некорректный запрос», as before, instead of «Проверьте поля формы» with field errors.
 */
async function asInvalidRequest<T>(request: Promise<ApiResult<T>>): Promise<ApiResult<T>> {
  const result = await request;
  if (result.ok || result.failure.kind !== 'validation') return result;
  return {
    ok: false,
    failure: {
      kind: 'domain',
      status: result.failure.status,
      error: 'badRequest',
      message: { key: 'admin.errors.invalidRequest' },
    },
  };
}
