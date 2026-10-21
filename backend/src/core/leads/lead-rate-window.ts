import { MILLISECONDS_PER_SECOND } from '~core/constants/time.constants';

import { LEAD_NOTIFY_CEILING, LEAD_RATE_LIMIT } from './lead.constants';

interface RateLimit {
  readonly max: number;
  readonly windowMs: number;
}

/**
 * A sliding window over the stored leads (the counter is the leads table itself, so the limits survive
 * restarts): at most `max` leads in the last `windowMs`.
 */
export class LeadRateWindow {
  /** Per visitor network: the 6th lead within 10 minutes is refused (429 with Retry-After). */
  static readonly PER_NETWORK = new LeadRateWindow(LEAD_RATE_LIMIT);
  /** Site-wide: past 60 leads within 10 minutes the Telegram notification is skipped. */
  static readonly SITE_WIDE = new LeadRateWindow(LEAD_NOTIFY_CEILING);

  private static readonly MILLISECONDS_PER_MINUTE = 60_000;

  private constructor(private readonly limit: RateLimit) {}

  get max(): number {
    return this.limit.max;
  }

  /** The window length in whole minutes (for messages). */
  get minutes(): number {
    return Math.round(this.limit.windowMs / LeadRateWindow.MILLISECONDS_PER_MINUTE);
  }

  /** Leads created at or after this time are in the window ending `now`. */
  startOf(now: Date): Date {
    return new Date(now.getTime() - this.limit.windowMs);
  }

  /** `count` leads in the window leave no room for another one. */
  isFullWith(count: number): boolean {
    return count >= this.limit.max;
  }

  /**
   * Seconds until the window has room again: when the oldest lead in it leaves (the whole window when
   * that lead is unknown), at least 1.
   */
  retryAfterSeconds(oldestInWindow: Date | undefined, now: Date): number {
    const resetAt = (oldestInWindow ?? now).getTime() + this.limit.windowMs;
    return Math.max(1, Math.ceil((resetAt - now.getTime()) / MILLISECONDS_PER_SECOND));
  }
}
