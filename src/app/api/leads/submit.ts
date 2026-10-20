import 'server-only';
import { type LeadFieldErrors, type LeadSubmission, validateLeadInput } from '@/lib/leads';
import { checkRateLimit, LEAD_NOTIFY_CEILING, type RecentLeadCounter } from '@/lib/rate-limit';
import type { TelegramLead } from '@/lib/telegram';

import type { LeadMeta } from './store';

/**
 * The lead submission flow without HTTP details (testable with fakes):
 *   validate → (honeypot: pretend success) → [locked per ipHash: rate limit → save] → schedule Telegram.
 * The lead is always saved BEFORE Telegram is contacted, and Telegram runs after the
 * response (`schedule`), so a Telegram outage never loses a lead or fails the request.
 * Site-wide flood guard: past LEAD_NOTIFY_CEILING leads are still saved, but marked
 * «не отправлено» instead of being pushed to Telegram (the owner can resend from the admin).
 */

/** DB operations available inside the per-ipHash critical section. */
export type LeadStore = {
  countRecent: RecentLeadCounter;
  oldestInWindow: (ipHash: string, since: Date) => Promise<Date | null>;
  /** All leads (any IP) created at or after `since`. */
  countAllRecent: (since: Date) => Promise<number>;
  insert: (
    lead: LeadSubmission,
    ipHash: string,
    meta: LeadMeta,
    options: { telegramError: string | null },
  ) => Promise<TelegramLead>;
};

export type SubmitLeadDeps = {
  /**
   * Runs `work` atomically for one ipHash: production = DB transaction + advisory lock
   * (store.ts → withLeadLock), so parallel requests cannot all pass the limit.
   */
  withLock: <T>(ipHash: string, work: (store: LeadStore) => Promise<T>) => Promise<T>;
  /** Called with the saved lead; must not throw (sendLeadToTelegram never does). */
  notify: (lead: TelegramLead) => Promise<unknown>;
  /**
   * Lead.telegramError of a lead saved past the site-wide ceiling — the owner-facing message
   * telegram.errors.notifyCeiling (production: notifyCeilingError in src/lib/telegram.ts).
   */
  ceilingError: (ceiling: typeof LEAD_NOTIFY_CEILING) => Promise<string>;
  /** Runs `task` after the response is sent (next/server `after` in the route). */
  schedule: (task: () => Promise<void>) => void;
  now?: () => Date;
};

export type SubmitLeadContext = {
  ipHash: string;
  userAgent: string | null;
  referer: string | null;
};

export type SubmitLeadOutcome =
  | { status: 'created'; id: string; notified: boolean }
  | { status: 'ignored' }
  | { status: 'invalid'; errors: LeadFieldErrors }
  | { status: 'rate_limited'; retryAfterSeconds: number }
  | { status: 'failed'; error: unknown };

type LockedOutcome =
  | { kind: 'limited'; retryAfterSeconds: number }
  | { kind: 'saved'; lead: TelegramLead; notify: boolean };

function clip(value: string | null, max: number): string | null {
  return value === null ? null : value.slice(0, max);
}

export async function submitLead(
  input: unknown,
  context: SubmitLeadContext,
  deps: SubmitLeadDeps,
): Promise<SubmitLeadOutcome> {
  const validation = validateLeadInput(input);
  if (!validation.ok) {
    if (validation.reason === 'honeypot') return { status: 'ignored' };
    return { status: 'invalid', errors: validation.errors };
  }

  const now = deps.now?.() ?? new Date();
  const meta: LeadMeta = {
    consentAt: now.toISOString(),
    userAgent: clip(context.userAgent, 300),
    referer: clip(context.referer, 500),
    source: 'site',
  };

  let outcome: LockedOutcome;
  try {
    outcome = await deps.withLock(context.ipHash, async (store): Promise<LockedOutcome> => {
      const limit = await checkRateLimit(context.ipHash, {
        count: store.countRecent,
        oldestInWindow: store.oldestInWindow,
        now,
      });
      if (limit.limited) return { kind: 'limited', retryAfterSeconds: limit.retryAfterSeconds };

      const siteWide = await store.countAllRecent(new Date(now.getTime() - LEAD_NOTIFY_CEILING.windowMs));
      const notify = siteWide < LEAD_NOTIFY_CEILING.max;
      const lead = await store.insert(validation.data, context.ipHash, meta, {
        telegramError: notify ? null : await deps.ceilingError(LEAD_NOTIFY_CEILING),
      });
      return { kind: 'saved', lead, notify };
    });
  } catch (error: unknown) {
    return { status: 'failed', error };
  }

  if (outcome.kind === 'limited') return { status: 'rate_limited', retryAfterSeconds: outcome.retryAfterSeconds };

  const saved = outcome.lead;
  if (!outcome.notify) {
    console.warn(
      `[leads] more than ${LEAD_NOTIFY_CEILING.max} leads in ${LEAD_NOTIFY_CEILING.windowMs / 60_000} min — lead ${saved.id} saved without a Telegram notification`,
    );
    return { status: 'created', id: saved.id, notified: false };
  }

  deps.schedule(async () => {
    try {
      await deps.notify(saved);
    } catch (error: unknown) {
      // notify() records failures itself; this is only a last-resort guard.
      console.error(`[leads] Telegram notification for lead ${saved.id} crashed:`, error);
    }
  });
  return { status: 'created', id: saved.id, notified: true };
}
