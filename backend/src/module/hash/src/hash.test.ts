import { ok, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import { HashService } from '~module/hash';

describe('HashService', () => {
  const subject = 'text-to-hash';
  const hashService = new HashService({});

  it('hashes and verifies', async () => {
    const hash = await hashService.hash(subject);
    ok(hash !== subject);
    ok(await hashService.verify(subject, hash));
  });

  it('salts every hash (no rainbow tables): same input, different hashes, both valid', async () => {
    const [hashFirst, hashSecond] = await Promise.all([hashService.hash(subject), hashService.hash(subject)]);
    ok(hashFirst !== hashSecond);
    ok(await hashService.verify(subject, hashFirst));
    ok(await hashService.verify(subject, hashSecond));
  });

  it('verifies a pre-created hash (format "<salt>:<key>" stays compatible)', async () => {
    const salt = '9910b0e021476c766571260b8fdc6498';
    const key = 'c2c435e94753cccf4b9a8140844cbae74c115a6f9311d88009ca81417abda109';
    ok(await hashService.verify(subject, `${salt}:${key}`));
  });

  it('rejects a wrong password', async () => {
    const hash = await hashService.hash(subject);
    strictEqual(await hashService.verify('another-text', hash), false);
  });

  it('never matches a malformed stored hash (instead of throwing)', async () => {
    for (const malformed of ['', 'no-delimiter', ':abcd', 'abcd:', 'abcd:zz', `abcd:${'00'.repeat(16)}`]) {
      strictEqual(await hashService.verify(subject, malformed), false, malformed);
    }
  });
});
