import { describe, expect, it, vi } from 'vitest';

import type { LeadSubmission } from '@/lib/leads';
import type { TelegramLead } from '@/lib/telegram';

import type { LeadMeta } from './store';

import { type LeadStore, type SubmitLeadDeps, submitLead } from './submit';

const NOW = new Date('2026-10-16T12:00:00.000Z');
const context = { ipHash: 'hash-1', userAgent: 'Mozilla/5.0', referer: 'https://gadyuka.ru/' };
const validInput = { type: 'TAILORING', name: 'Иван', phone: '+7 900 123-45-67', consent: true, locale: 'ru', hp: '' };
/** Stands in for the owner-facing message telegram.errors.notifyCeiling (formatted in src/lib/telegram.ts). */
const CEILING_ERROR = 'not sent: flood ceiling';

function makeDeps(overrides: Partial<Omit<SubmitLeadDeps, 'withLock'>> = {}, storeOverrides: Partial<LeadStore> = {}) {
  const tasks: Array<() => Promise<void>> = [];
  const insert = vi.fn(
    async (
      lead: LeadSubmission,
      _ipHash: string,
      _meta: LeadMeta,
      _options: { telegramError: string | null },
    ): Promise<TelegramLead> => ({
      id: 'lead-1',
      ...lead,
      createdAt: NOW,
    }),
  );
  const notify = vi.fn(async (_lead: TelegramLead) => ({ ok: true }));
  const ceilingError = vi.fn(async (ceiling: { max: number; windowMs: number }) => `${CEILING_ERROR} ${ceiling.max}`);
  const store = {
    countRecent: vi.fn(async (_ipHash: string, _since: Date) => 0),
    oldestInWindow: vi.fn(async (_ipHash: string, _since: Date): Promise<Date | null> => null),
    countAllRecent: vi.fn(async (_since: Date) => 0),
    insert,
    ...storeOverrides,
  } satisfies LeadStore;
  const locks: string[] = [];
  const deps = {
    withLock: async <T>(ipHash: string, work: (current: LeadStore) => Promise<T>): Promise<T> => {
      locks.push(ipHash);
      return work(store);
    },
    notify,
    ceilingError,
    schedule: (task: () => Promise<void>) => {
      tasks.push(task);
    },
    now: () => NOW,
    ...overrides,
  } satisfies SubmitLeadDeps;
  return { deps, store, tasks, insert, notify, locks, ceilingError };
}

describe('submitLead', () => {
  it('saves the lead first and schedules Telegram after the response', async () => {
    const { deps, tasks, insert, notify, locks } = makeDeps();
    const outcome = await submitLead(validInput, context, deps);
    expect(outcome).toEqual({ status: 'created', id: 'lead-1', notified: true });
    expect(locks).toEqual(['hash-1']);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'TAILORING', name: 'Иван', phone: '+79001234567', email: null }),
      'hash-1',
      { consentAt: NOW.toISOString(), userAgent: 'Mozilla/5.0', referer: 'https://gadyuka.ru/', source: 'site' },
      { telegramError: null },
    );
    expect(notify).not.toHaveBeenCalled(); // not before the response
    expect(tasks).toHaveLength(1);
    await tasks[0]?.();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ id: 'lead-1' }));
  });

  it('never loses a lead when the Telegram notification crashes', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { deps, tasks, insert } = makeDeps({
      notify: vi.fn(async () => {
        throw new Error('telegram exploded');
      }),
    });
    const outcome = await submitLead(validInput, context, deps);
    expect(outcome.status).toBe('created');
    expect(insert).toHaveBeenCalledTimes(1);
    await expect(tasks[0]?.()).resolves.toBeUndefined();
  });

  it('ignores honeypot submissions without touching the DB', async () => {
    const { deps, store, insert, tasks, locks } = makeDeps();
    const outcome = await submitLead({ ...validInput, hp: 'https://spam.example' }, context, deps);
    expect(outcome).toEqual({ status: 'ignored' });
    expect(locks).toHaveLength(0);
    expect(store.countRecent).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(tasks).toHaveLength(0);
  });

  it('returns field errors for invalid input', async () => {
    const { deps, insert } = makeDeps();
    const outcome = await submitLead({ ...validInput, phone: '', consent: false }, context, deps);
    expect(outcome).toEqual({
      status: 'invalid',
      errors: { consent: { code: 'consentRequired' }, contact: { code: 'contactRequired' } },
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it('rate-limits the 6th lead from the same IP hash', async () => {
    const { deps, store, insert } = makeDeps({}, { countRecent: vi.fn(async () => 5) });
    const outcome = await submitLead(validInput, context, deps);
    expect(outcome).toEqual({ status: 'rate_limited', retryAfterSeconds: 600 });
    expect(store.countRecent).toHaveBeenCalledWith('hash-1', new Date(NOW.getTime() - 10 * 60 * 1000));
    expect(insert).not.toHaveBeenCalled();
  });

  it('counts and inserts inside the per-IP critical section (no count-then-insert race)', async () => {
    const order: string[] = [];
    const { deps } = makeDeps(
      {},
      {
        countRecent: vi.fn(async () => {
          order.push('count');
          return 0;
        }),
        insert: vi.fn(async (lead: LeadSubmission): Promise<TelegramLead> => {
          order.push('insert');
          return { id: 'lead-1', ...lead, createdAt: NOW };
        }),
      },
    );
    const withLock = deps.withLock;
    await submitLead(validInput, context, {
      ...deps,
      withLock: async (ipHash, work) => {
        order.push('lock');
        const result = await withLock(ipHash, work);
        order.push('unlock');
        return result;
      },
    });
    expect(order).toEqual(['lock', 'count', 'insert', 'unlock']);
  });

  it('past the site-wide ceiling: stores the lead but skips Telegram (marked for manual resend)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { deps, store, insert, tasks, notify, ceilingError } = makeDeps(
      {},
      { countAllRecent: vi.fn(async () => 60) },
    );
    const outcome = await submitLead(validInput, context, deps);
    expect(outcome).toEqual({ status: 'created', id: 'lead-1', notified: false });
    expect(store.countAllRecent).toHaveBeenCalledWith(new Date(NOW.getTime() - 10 * 60 * 1000));
    expect(ceilingError).toHaveBeenCalledWith({ max: 60, windowMs: 10 * 60 * 1000 });
    expect(insert.mock.calls[0]?.[3]).toEqual({ telegramError: `${CEILING_ERROR} 60` });
    expect(tasks).toHaveLength(0);
    expect(notify).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it('reports DB failures instead of throwing', async () => {
    const error = new Error('connection refused');
    const { deps } = makeDeps({}, { insert: vi.fn(async () => Promise.reject(error)) });
    await expect(submitLead(validInput, context, deps)).resolves.toEqual({ status: 'failed', error });
  });

  it('clips long user agents / referers in meta', async () => {
    const { deps, insert } = makeDeps();
    await submitLead(validInput, { ...context, userAgent: 'u'.repeat(1000), referer: null }, deps);
    const meta = insert.mock.calls[0]?.[2];
    expect(meta?.userAgent).toHaveLength(300);
    expect(meta?.referer).toBeNull();
  });
});
