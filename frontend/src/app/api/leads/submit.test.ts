import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiResult } from '@/lib/api/api-result';
import type { LeadSubmitResponse } from '@shared/contracts/leads';

const submitLead = vi.fn<(...args: unknown[]) => Promise<ApiResult<LeadSubmitResponse>>>();
vi.mock('@/lib/api/leads', () => ({ submitLead }));

const { leadPayloadOf, submitLeadForVisitor } = await import('./submit');

const visitor = { clientIp: '203.0.113.7', userAgent: 'Mozilla/5.0' };
const context = { visitor, referer: 'https://gadyuka.ru/' };
const input = { type: 'TAILORING', name: 'Иван', phone: '+7 900 123-45-67', consent: true, locale: 'ru', hp: '' };

function validation(fields: Record<string, { key: string; values?: Record<string, number> }>): ApiResult<never> {
  return { ok: false, failure: { kind: 'validation', status: 400, fields } };
}

beforeEach(() => {
  submitLead.mockReset();
  submitLead.mockResolvedValue({ ok: true, status: 201, data: { id: 'lead-1' } });
});

describe('leadPayloadOf', () => {
  it('keeps only the fields of the form, values as received, plus the referer', () => {
    expect(leadPayloadOf({ ...input, admin: true, status: 'DONE' }, 'https://gadyuka.ru/')).toEqual({
      ...input,
      referer: 'https://gadyuka.ru/',
    });
    expect(leadPayloadOf({ name: 42, hp: null, email: undefined }, null)).toEqual({ name: 42, hp: null });
  });

  it('sends no fields for a payload that is not an object', () => {
    for (const raw of [null, 'text', 42, ['a']]) expect(leadPayloadOf(raw, null)).toEqual({});
  });
});

describe('submitLeadForVisitor', () => {
  it('submits for the visitor and answers the stored id', async () => {
    await expect(submitLeadForVisitor(input, context)).resolves.toEqual({ status: 'created', id: 'lead-1' });
    expect(submitLead).toHaveBeenCalledWith({ ...input, referer: 'https://gadyuka.ru/' }, visitor);
  });

  it('maps the backend field errors to the form error codes (unknown fields and keys left out)', async () => {
    submitLead.mockResolvedValueOnce(
      validation({
        name: { key: 'forms.errors.tooShort', values: { min: 2 } },
        message: { key: 'forms.errors.tooLong', values: { max: 2000 } },
        consent: { key: 'forms.errors.consentRequired' },
        contact: { key: 'forms.errors.contactRequired' },
        type: { key: 'forms.errors.invalid' },
        referer: { key: 'forms.errors.invalid' },
        email: { key: 'admin.validation.unknownField' },
      }),
    );
    await expect(submitLeadForVisitor(input, context)).resolves.toEqual({
      status: 'invalid',
      errors: {
        type: { code: 'invalid' },
        name: { code: 'tooShort', min: 2 },
        message: { code: 'tooLong', max: 2000 },
        consent: { code: 'consentRequired' },
        contact: { code: 'contactRequired' },
      },
    });
  });

  it('treats a refusal without any field of the form as a failure', async () => {
    submitLead.mockResolvedValueOnce(validation({ admin: { key: 'admin.validation.unknownField' } }));
    await expect(submitLeadForVisitor(input, context)).resolves.toMatchObject({ status: 'failed' });
  });

  it('reports the rate limit with the backend Retry-After (10 minutes when it does not say)', async () => {
    const throttled = (details?: Record<string, number>): ApiResult<never> => ({
      ok: false,
      failure: {
        kind: 'domain',
        status: 429,
        error: 'throttled',
        message: { key: 'forms.errors.rateLimited' },
        ...(details ? { details } : {}),
      },
    });
    submitLead.mockResolvedValueOnce(throttled({ retryAfterSeconds: 359.2 }));
    await expect(submitLeadForVisitor(input, context)).resolves.toEqual({
      status: 'rate_limited',
      retryAfterSeconds: 360,
    });
    submitLead.mockResolvedValueOnce(throttled());
    await expect(submitLeadForVisitor(input, context)).resolves.toEqual({
      status: 'rate_limited',
      retryAfterSeconds: 600,
    });
  });

  it('reports an unreachable or failing backend as a failure, never throws', async () => {
    submitLead.mockResolvedValueOnce({ ok: false, failure: { kind: 'unavailable', status: null, reason: 'network' } });
    await expect(submitLeadForVisitor(input, context)).resolves.toEqual({
      status: 'failed',
      reason: 'unavailable: network',
    });
    submitLead.mockResolvedValueOnce({
      ok: false,
      failure: { kind: 'domain', status: 500, error: 'internal', message: { key: 'admin.errors.actionFailed' } },
    });
    await expect(submitLeadForVisitor(input, context)).resolves.toMatchObject({ status: 'failed' });
  });
});
