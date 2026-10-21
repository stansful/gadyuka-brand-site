import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiResult } from './api-result';
import type { ApiRequestOptions } from './client';

const adminRequest = vi.fn<(path: string, options?: ApiRequestOptions) => Promise<ApiResult<unknown>>>();
vi.mock('./admin', () => ({ adminRequest }));

const { resendLeadToTelegram } = await import('./leads');

describe('admin lead calls', () => {
  beforeEach(() => adminRequest.mockReset());

  it('waits for the Telegram re-send as long as the contract allows (LeadResendTimeoutMs), not the default 10 s', async () => {
    adminRequest.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: { id: 'l1', telegramSent: true, telegramError: null },
    });
    await resendLeadToTelegram('l1');
    expect(adminRequest).toHaveBeenCalledWith('/api/v1/admin/leads/l1/resend', { method: 'POST', timeoutMs: 50_000 });
  });
});
