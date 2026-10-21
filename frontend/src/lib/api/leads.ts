import 'server-only';
import type {
  LeadDetailResponse,
  LeadListQuery,
  LeadListResponse,
  LeadResendResponse,
  LeadResendTimeoutMs,
  LeadStatus,
  LeadStatusResponse,
  LeadSubmitPayload,
  LeadSubmitResponse,
  LeadTelegramStatusResponse,
} from '@shared/contracts/leads';

import type { ApiResult } from './api-result';

import { adminRequest } from './admin';
import { apiRequest, type ApiPath, type VisitorInfo } from './client';

/**
 * Leads through the backend (shared/contracts/leads.ts): the site form's submission, made for the
 * visitor (their IP and user agent are forwarded: rate limit, Lead.meta), and the admin's list, lead
 * page, status, Telegram re-send and dry-run status (/api/v1/admin/leads, with the admin's session).
 */

const PUBLIC_LEADS_PATH = '/api/v1/public/leads' satisfies ApiPath;
const ADMIN_LEADS_PATH = '/api/v1/admin/leads' satisfies ApiPath;

/**
 * The re-send answers once Telegram has (every attempt, the retries and their waits): the client
 * waits the contract's bound for it, not the default 10 s — giving up earlier showed a generic
 * failure while the send went on, and a second click sent the lead twice.
 */
const LEAD_RESEND_TIMEOUT_MS: LeadResendTimeoutMs = 50_000;

export function submitLead(payload: LeadSubmitPayload, visitor: VisitorInfo): Promise<ApiResult<LeadSubmitResponse>> {
  return apiRequest<LeadSubmitResponse>(PUBLIC_LEADS_PATH, { method: 'POST', body: payload, visitor });
}

export function listLeads(query: LeadListQuery): Promise<ApiResult<LeadListResponse>> {
  return adminRequest<LeadListResponse>(ADMIN_LEADS_PATH, {
    query: { type: query.type, status: query.status, page: query.page },
  });
}

export function getLead(id: string): Promise<ApiResult<LeadDetailResponse>> {
  return adminRequest<LeadDetailResponse>(`${ADMIN_LEADS_PATH}/${encodeURIComponent(id)}`);
}

export function saveLeadStatus(id: string, status: LeadStatus): Promise<ApiResult<LeadStatusResponse>> {
  return adminRequest<LeadStatusResponse>(`${ADMIN_LEADS_PATH}/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

export function resendLeadToTelegram(id: string): Promise<ApiResult<LeadResendResponse>> {
  return adminRequest<LeadResendResponse>(`${ADMIN_LEADS_PATH}/${encodeURIComponent(id)}/resend`, {
    method: 'POST',
    timeoutMs: LEAD_RESEND_TIMEOUT_MS,
  });
}

export function getLeadTelegramStatus(): Promise<ApiResult<LeadTelegramStatusResponse>> {
  return adminRequest<LeadTelegramStatusResponse>(`${ADMIN_LEADS_PATH}/telegram/status`);
}
