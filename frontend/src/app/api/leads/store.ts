import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import type { LeadSubmission } from '@/lib/leads';
import type { TelegramLead } from '@/lib/telegram';

import type { LeadStore } from './submit';

/**
 * DB access for POST /api/leads (kept separate so the flow can be tested with fakes).
 *
 * withLeadLock() runs the rate-limit check AND the insert in one transaction that first
 * takes a transaction-scoped advisory lock on the client's ipHash. Concurrent requests from
 * the same network therefore queue up and each one sees the leads committed before it, so a
 * burst of parallel requests cannot all pass the "count < max" check.
 */

/** First key of the two-key advisory lock: namespaces our locks ("lead"). */
const LEAD_LOCK_NAMESPACE = 0x1ead;

export type LeadMeta = {
  /** ISO time the consent checkbox was submitted (152-ФЗ). */
  consentAt: string;
  userAgent: string | null;
  referer: string | null;
  source: 'site';
};

const telegramLeadSelect = {
  id: true,
  type: true,
  name: true,
  email: true,
  phone: true,
  message: true,
  locale: true,
  createdAt: true,
} as const;

function leadStore(tx: Prisma.TransactionClient): LeadStore {
  return {
    countRecent: (ipHash, since) => tx.lead.count({ where: { ipHash, createdAt: { gte: since } } }),
    oldestInWindow: async (ipHash, since) => {
      const row = await tx.lead.findFirst({
        where: { ipHash, createdAt: { gte: since } },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      });
      return row?.createdAt ?? null;
    },
    countAllRecent: since => tx.lead.count({ where: { createdAt: { gte: since } } }),
    insert: (lead: LeadSubmission, ipHash: string, meta: LeadMeta, options): Promise<TelegramLead> => {
      const metaJson: Prisma.InputJsonObject = {
        consentAt: meta.consentAt,
        userAgent: meta.userAgent,
        referer: meta.referer,
        source: meta.source,
      };
      return tx.lead.create({
        data: {
          type: lead.type,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          message: lead.message,
          locale: lead.locale,
          ipHash,
          meta: metaJson,
          telegramError: options.telegramError,
        },
        select: telegramLeadSelect,
      });
    },
  };
}

/** Runs `work` in a transaction serialized per ipHash (pg_advisory_xact_lock). */
export async function withLeadLock<T>(ipHash: string, work: (store: LeadStore) => Promise<T>): Promise<T> {
  return db.$transaction(
    async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LEAD_LOCK_NAMESPACE}::int4, hashtext(${ipHash}::text))`;
      return work(leadStore(tx));
    },
    { maxWait: 5_000, timeout: 10_000 },
  );
}
