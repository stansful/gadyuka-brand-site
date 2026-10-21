import 'server-only';
import { ApiRequestError, describeFailure } from '@/lib/api/api-result';
import { getLead, getLeadTelegramStatus, listLeads } from '@/lib/api/leads';
import type { LeadDetailResponse, LeadListResponse, LeadStatus, LeadType } from '@shared/contracts/leads';

import { requireAdminPage } from '../auth';

/**
 * Leads list and detail, and the Telegram dry-run status of the admin frame.
 *
 * Data from the backend (/api/v1/admin/leads, src/lib/api/leads.ts). EVERY exported function
 * authorizes first (requireAdminPage → redirect to /admin/login), so a page can never read admin data
 * without a session. A backend failure throws (the admin error page shows) — except the dry-run banner,
 * which is left out instead.
 */

export type LeadFilters = { type: LeadType | null; status: LeadStatus | null; page: number };

/** 25 leads per page, newest first; the backend clamps `page` to the pages there are. */
export async function listLeadsAdmin(filters: LeadFilters): Promise<LeadListResponse> {
  await requireAdminPage();
  const requested = Number.isFinite(filters.page) ? Math.trunc(filters.page) : 1;
  const page = Math.min(Math.max(1, requested), Number.MAX_SAFE_INTEGER);
  const result = await listLeads({ type: filters.type ?? undefined, status: filters.status ?? undefined, page });
  if (!result.ok) throw new ApiRequestError('/api/v1/admin/leads', result.failure);
  return result.data;
}

/** The lead, or null when there is none with this id (unknown or malformed). */
export async function getLeadDetail(id: string): Promise<LeadDetailResponse | null> {
  await requireAdminPage();
  const result = await getLead(id);
  if (result.ok) return result.data;
  const { failure } = result;
  if (failure.kind === 'validation' || (failure.kind === 'domain' && failure.status === 404)) return null;
  throw new ApiRequestError('/api/v1/admin/leads/:id', failure);
}

/** TELEGRAM_DRY_RUN of the backend: leads are stored but not sent (false when it cannot be read). */
export async function isTelegramDryRun(): Promise<boolean> {
  await requireAdminPage();
  const result = await getLeadTelegramStatus();
  if (result.ok) return result.data.dryRun;
  console.error(`[admin] Telegram status unavailable: ${describeFailure(result.failure)}`);
  return false;
}
