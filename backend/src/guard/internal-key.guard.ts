import { createHash, timingSafeEqual } from 'node:crypto';

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NodeRequest } from '@nestjs/platform-node';

import { ConfigService } from '~config';
import { RequestHeader } from '~core/constants/request-header.enum';
import { NoInternalKey } from '~decorator';
import { InternalKeyRequiredException } from '~exception';

/**
 * Global: every request must carry `x-internal-key: <INTERNAL_API_KEY>` (only the Next.js server
 * knows it), except routes marked @NoInternalKey() (GET|HEAD /media/*). Constant-time comparison.
 */
@Injectable()
export class InternalKeyGuard implements CanActivate {
  private readonly expectedDigest: Buffer;

  constructor(
    private readonly reflector: Reflector,
    config: ConfigService,
  ) {
    this.expectedDigest = this.digest(config.getSafety('INTERNAL_API_KEY'));
  }

  canActivate(context: ExecutionContext): boolean {
    if (this.reflector.getAllAndOverride(NoInternalKey, [context.getHandler(), context.getClass()])) {
      return true;
    }
    const header = context.switchToHttp().getRequest<NodeRequest>().headers[RequestHeader.INTERNAL_KEY];
    if (typeof header !== 'string' || !timingSafeEqual(this.digest(header), this.expectedDigest)) {
      throw new InternalKeyRequiredException();
    }
    return true;
  }

  /** Comparing digests keeps the comparison constant-time whatever the length of the header. */
  private digest(value: string): Buffer {
    return createHash('sha256').update(value).digest();
  }
}
