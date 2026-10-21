import { Injectable } from '@nestjs/common';

import { DatabaseService } from '~database';

import { LockedLeadStore } from './locked-lead.store';

/** Storage of new leads: every check and the insert of one network run serialized in one transaction. */
@Injectable()
export class LeadSubmissionRepository {
  /** First key of the two-key advisory lock: the namespace of the lead locks ("lead") */
  private static readonly LOCK_NAMESPACE = 0x1ead;
  /**
   * Waiting for a pool connection + the locked work: together well inside the site server's request
   * timeout (shared/contracts/http.ts ApiRequestTimeoutMs, 10 s), so the visitor is never told «failed»
   * about a lead that still commits afterwards (and sends it again). Past them the lead rolls back and the
   * answer is a 5xx — the same outcome the visitor sees.
   */
  static readonly TRANSACTION_OPTIONS = { maxWait: 2_000, timeout: 5_000 } as const;

  constructor(private readonly database: DatabaseService) {}

  /**
   * Runs `work` in a transaction that first takes the advisory lock of the network (pg_advisory_xact_lock
   * on the hash, released at commit / rollback): concurrent requests of one network queue up, and each
   * sees the leads committed before it.
   */
  withNetworkLock<T>(ipHash: string, work: (store: LockedLeadStore) => Promise<T>): Promise<T> {
    return this.database.client.$transaction(async transaction => {
      const namespace = LeadSubmissionRepository.LOCK_NAMESPACE;
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${namespace}::int4, hashtext(${ipHash}::text))`;
      return work(new LockedLeadStore(transaction));
    }, LeadSubmissionRepository.TRANSACTION_OPTIONS);
  }
}
