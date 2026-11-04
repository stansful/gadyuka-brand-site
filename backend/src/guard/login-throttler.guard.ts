import { ExecutionContext, Injectable } from '@nestjs/common';
import { NodeRequest } from '@nestjs/platform-node';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';

import { TooManyAttemptsException } from '~exception';
import { ClientIpResolver } from '~module/common';

/**
 * Brute-force protection of POST /auth/login (@nestjs/throttler, in memory: one instance):
 * attempts are counted per visitor IP (x-client-ip) + login; over the limit → 429 with the minutes
 * to wait (admin.auth.throttled).
 */
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  private static readonly SECONDS_PER_MINUTE = 60;
  private readonly clientIp = new ClientIpResolver();

  protected override async getTracker(request: NodeRequest): Promise<string> {
    return `${this.clientIp.resolve(request)}|${this.loginOf(request.body)}`;
  }

  protected override async throwThrottlingException(
    _context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const minutes = Math.max(1, Math.ceil(detail.timeToBlockExpire / LoginThrottlerGuard.SECONDS_PER_MINUTE));
    throw new TooManyAttemptsException(minutes);
  }

  private loginOf(body: unknown): string {
    const login = typeof body === 'object' && body !== null && 'login' in body ? body.login : undefined;
    return typeof login === 'string' ? login.trim().toLowerCase() : '';
  }
}
