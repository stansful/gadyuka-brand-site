import { notStrictEqual, ok, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import type { ApiRequestTimeoutMs } from '~shared/contracts/http';

import { ConfigService } from '~config';
import { VisitorIpHasher } from '~module/common';
import { TestEnvironment } from '~test/test-environment';

import { DecoyLeadId } from './decoy-lead-id';
import { LeadSubmissionRepository } from './lead-submission.repository';

/** shared/contracts/http.ts: how long the site's server waits for the answer. */
const CLIENT_WAIT_MS: ApiRequestTimeoutMs = 10_000;
/** Room left outside the transaction: the request checks, the Telegram texts (a read when not cached), the answer. */
const ROOM_OUTSIDE_TRANSACTION_MS = 3_000;

describe('VisitorIpHasher', () => {
  const hasher = new VisitorIpHasher(new ConfigService(TestEnvironment.valid({ IP_HASH_SALT: ' pepper-0123456789 ' })));

  it('is HMAC-SHA256(key = IP_HASH_SALT, network) in hex', () => {
    // printf '203.0.113.7' | openssl dgst -sha256 -hmac pepper-0123456789
    strictEqual(hasher.hashOf('203.0.113.7'), '41f776a2b3eeeb5aa671c038cec405dc7962f29622441b4915e56c2d29474291');
    // printf '2001:db8:1:2::/64' | openssl dgst -sha256 -hmac pepper-0123456789
    strictEqual(hasher.hashOf('2001:DB8:1:2::7'), '58d8b17a1140f52ef4b79554e383a832b48042e7b684d53d2464cfcecffe956e');
  });

  it('keys IPv6 visitors by their /64 and never contains the IP', () => {
    strictEqual(hasher.hashOf('2001:db8:1:2:aaaa::1'), hasher.hashOf('2001:db8:1:2:ffff:ffff:ffff:ffff'));
    notStrictEqual(hasher.hashOf('2001:db8:1:3::1'), hasher.hashOf('2001:db8:1:2::1'));
    ok(!hasher.hashOf('203.0.113.7').includes('203'));
  });

  it('puts visitors without a known IP into one shared bucket', () => {
    // printf 'unknown' | openssl dgst -sha256 -hmac pepper-0123456789
    strictEqual(hasher.hashOf('unknown'), '34ba6653a59c17e3d79c1d994d3cb40b38b327c7ff7fd320f9c89326ac7573c5');
  });
});

describe('DecoyLeadId', () => {
  it('looks like the id of a stored lead (UUID v7 with the creation time)', () => {
    const now = Date.parse('2026-10-21T12:00:00.000Z');
    const id = new DecoyLeadId().create(now);
    ok(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id), id);
    strictEqual(Number.parseInt(id.replace(/-/g, '').slice(0, 12), 16), now);
    notStrictEqual(new DecoyLeadId().create(now), id);
  });
});

describe('LeadSubmissionRepository', () => {
  it("commits or rolls back before the site's server gives up on the answer", () => {
    const { maxWait, timeout } = LeadSubmissionRepository.TRANSACTION_OPTIONS;
    ok(maxWait + timeout + ROOM_OUTSIDE_TRANSACTION_MS <= CLIENT_WAIT_MS, `${maxWait} + ${timeout} ms`);
  });
});
