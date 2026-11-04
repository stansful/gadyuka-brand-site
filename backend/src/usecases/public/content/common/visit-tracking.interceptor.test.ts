import { deepStrictEqual, ok } from 'node:assert';
import { before, describe, it } from 'node:test';

import { CallHandler, ExecutionContext } from '@nestjs/common';

import { of, lastValueFrom } from 'rxjs';

import { VisitorIpHasher } from '~module/common';

import { VisitTrackingInterceptor } from './visit-tracking.interceptor';
import { VisitRepository } from './visit.repository';

interface UpsertCall {
  hourBucket: Date;
  ipHash: string;
  userAgent: string | null;
  path: string | null;
}

class FakeVisitRepository {
  calls: UpsertCall[] = [];
  nextError: Error | null = null;

  async upsert(call: UpsertCall): Promise<void> {
    if (this.nextError) {
      const error = this.nextError;
      this.nextError = null;
      throw error;
    }
    this.calls.push(call);
  }
}

function buildContext(clientIp: string, userAgent: string | undefined, url: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {
          'x-client-ip': clientIp,
          'x-client-user-agent': userAgent,
        },
        url,
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('VisitTrackingInterceptor', () => {
  let hasher: VisitorIpHasher;
  let repository: FakeVisitRepository;
  let interceptor: VisitTrackingInterceptor;

  before(() => {
    hasher = new VisitorIpHasher({ getSafety: () => 'test-salt' } as never);
  });

  before(() => {
    repository = new FakeVisitRepository();
    interceptor = new VisitTrackingInterceptor(hasher, repository as unknown as VisitRepository);
  });

  async function track(clientIp: string, userAgent: string | undefined, url: string): Promise<void> {
    const handler: CallHandler = { handle: () => of('ok') };
    const result$ = interceptor.intercept(buildContext(clientIp, userAgent, url), handler);
    await lastValueFrom(result$);
  }

  it('records a visit with hashed IP, hour bucket, user agent and path', async () => {
    await track('203.0.113.5', 'Mozilla/5.0', '/ru');
    deepStrictEqual(repository.calls.length, 1);
    const call = repository.calls[0];
    ok(/^[0-9a-f]{64}$/.test(call.ipHash));
    ok(Math.abs(call.hourBucket.getTime() - Date.now()) < 3_600_000);
    deepStrictEqual(call.userAgent, 'Mozilla/5.0');
    deepStrictEqual(call.path, '/ru');
  });

  it('records a visit even without a forwarded user agent', async () => {
    await track('203.0.113.6', undefined, '/en');
    deepStrictEqual(repository.calls.length, 2);
    deepStrictEqual(repository.calls[1].userAgent, null);
  });

  it('does not throw when the repository fails', async () => {
    repository.nextError = new Error('database down');
    await track('203.0.113.7', 'bot', '/');
    deepStrictEqual(repository.calls.length, 2, 'no new call because the repository threw');
  });
});
