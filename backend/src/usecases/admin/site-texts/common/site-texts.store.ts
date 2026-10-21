import { Injectable } from '@nestjs/common';

import { DatabaseService } from '~database';

import { SiteTextsSession } from './site-texts.session';

/**
 * Writes of the admin «Тексты сайта» (save, reset): each runs in a transaction that first takes the
 * «Тексты сайта» advisory lock, so a save reads the rows it checks for conflicts and writes them with
 * no other save or reset in between (each one sees what the previous one committed).
 */
@Injectable()
export class SiteTextsStore {
  /** First key of the two-key transaction advisory lock that serializes the «Тексты сайта» writes. */
  static readonly LOCK_NAMESPACE = 0x7e47;
  static readonly LOCK_KEY = 0;
  /**
   * Covers waiting for the lock and a large save (every text of a search). Together with the checks
   * around the transaction, inside the frontend's wait (shared/contracts/site-texts.ts
   * SiteTextsWriteTimeoutMs), so the admin is never told «не удалось» about a save that still commits.
   */
  static readonly TRANSACTION_OPTIONS = { maxWait: 5_000, timeout: 30_000 } as const;

  constructor(private readonly database: DatabaseService) {}

  runLocked<T>(work: (session: SiteTextsSession) => Promise<T>): Promise<T> {
    return this.database.client.$transaction(async transaction => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${SiteTextsStore.LOCK_NAMESPACE}::int4, ${SiteTextsStore.LOCK_KEY}::int4)`;
      return work(new SiteTextsSession(transaction));
    }, SiteTextsStore.TRANSACTION_OPTIONS);
  }
}
