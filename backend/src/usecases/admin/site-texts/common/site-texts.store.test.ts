import { ok } from 'node:assert';
import { describe, it } from 'node:test';

import type { SiteTextsWriteTimeoutMs } from '~shared/contracts/site-texts';

import { SiteTextsStore } from './site-texts.store';

/** shared/contracts/site-texts.ts: how long the admin's client waits for a save / reset answer. */
const CLIENT_WAIT_MS: SiteTextsWriteTimeoutMs = 45_000;
/** Room left outside the transaction: the request checks, the definitions and media lookups, the answer. */
const ROOM_OUTSIDE_TRANSACTION_MS = 5_000;

describe('SiteTextsStore', () => {
  it("commits or rolls back before the admin's client gives up on the answer", () => {
    const { maxWait, timeout } = SiteTextsStore.TRANSACTION_OPTIONS;
    ok(maxWait + timeout + ROOM_OUTSIDE_TRANSACTION_MS <= CLIENT_WAIT_MS, `${maxWait} + ${timeout} ms`);
  });
});
