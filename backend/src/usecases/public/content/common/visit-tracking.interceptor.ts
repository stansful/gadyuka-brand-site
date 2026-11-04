import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { NodeRequest } from '@nestjs/platform-node';

import { Observable, tap } from 'rxjs';

import { RequestContext } from '~decorator';
import { VisitorIpHasher } from '~module/common';

import { VisitRepository } from './visit.repository';

function startOfHourUTC(date: Date): Date {
  const truncated = new Date(date.getTime());
  truncated.setUTCMinutes(0, 0, 0);
  return truncated;
}

/**
 * Records anonymous, unique visits of public pages: one row per (hour, hashed visitor IP).
 * Failures are logged and swallowed so they never affect the site's response.
 */
@Injectable()
export class VisitTrackingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(VisitTrackingInterceptor.name);

  constructor(
    private readonly hasher: VisitorIpHasher,
    private readonly visits: VisitRepository,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const clientIp = RequestContext.clientIpOf(undefined, context);
    const userAgent = RequestContext.userAgentOf(undefined, context);
    const path = context.switchToHttp().getRequest<NodeRequest>().url ?? null;
    const hourBucket = startOfHourUTC(new Date());

    return next.handle().pipe(
      tap(() => {
        this.record(hourBucket, clientIp, userAgent, path).catch(error => {
          this.logger.error('Visit tracking failed', error);
        });
      }),
    );
  }

  private async record(
    hourBucket: Date,
    clientIp: string,
    userAgent: string | undefined,
    path: string | null,
  ): Promise<void> {
    await this.visits.upsert({
      hourBucket,
      ipHash: this.hasher.hashOf(clientIp),
      userAgent: userAgent ?? null,
      path,
    });
  }
}
