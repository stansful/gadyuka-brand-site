/**
 * In-memory brute-force protection for the admin login form: at most
 * `maxFailures` failed attempts per client key within `windowMs`.
 *
 * Single-instance only (the app runs as one container); a restart resets it,
 * which is acceptable for an optional password gate.
 */
export type ThrottleOptions = {
  maxFailures: number;
  windowMs: number;
  /** Upper bound of tracked keys (oldest entries are evicted first). */
  maxKeys?: number;
};

type Entry = { failures: number; resetAt: number };

export class LoginThrottle {
  private readonly entries = new Map<string, Entry>();
  private readonly maxFailures: number;
  private readonly windowMs: number;
  private readonly maxKeys: number;

  constructor(options: ThrottleOptions) {
    this.maxFailures = options.maxFailures;
    this.windowMs = options.windowMs;
    this.maxKeys = options.maxKeys ?? 5000;
  }

  /** Milliseconds until the key may try again, or 0 when it is not blocked. */
  retryAfterMs(key: string, now: number = Date.now()): number {
    const entry = this.entries.get(key);
    if (!entry) return 0;
    if (entry.resetAt <= now) {
      this.entries.delete(key);
      return 0;
    }
    return entry.failures >= this.maxFailures ? entry.resetAt - now : 0;
  }

  recordFailure(key: string, now: number = Date.now()): void {
    const entry = this.entries.get(key);
    if (!entry || entry.resetAt <= now) {
      if (this.entries.size >= this.maxKeys) {
        const oldest = this.entries.keys().next();
        if (!oldest.done) this.entries.delete(oldest.value);
      }
      this.entries.set(key, { failures: 1, resetAt: now + this.windowMs });
      return;
    }
    entry.failures += 1;
  }

  reset(key: string): void {
    this.entries.delete(key);
  }
}
