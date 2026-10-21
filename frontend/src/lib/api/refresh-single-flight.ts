import type { AuthTokensResponse } from '@shared/contracts/auth';

/** What a refresh attempt ended with. */
export type RefreshOutcome =
  | { readonly kind: 'refreshed'; readonly tokens: AuthTokensResponse }
  /** The backend refused the refresh token (expired, revoked, already used): the session is over */
  | { readonly kind: 'rejected' }
  /** No answer (backend down / timeout): keep the cookies, the next request tries again */
  | { readonly kind: 'unavailable' };

export type RefreshSingleFlightOptions = {
  /** How long a settled outcome is reused for the same refresh token (late duplicates). */
  readonly reuseMs?: number;
  /** Upper bound of remembered tokens (oldest dropped first). */
  readonly maxEntries?: number;
  readonly now?: () => number;
};

type Flight = { readonly outcome: Promise<RefreshOutcome>; readonly startedAt: number };

/**
 * Refresh ONCE per refresh token. The backend rotates the token on every refresh and revokes the
 * whole session when a spent token is presented again — but a browser sends several requests at
 * once (the page, RSC requests, server actions), all carrying the same expired access cookie and
 * the same refresh cookie. Every one of them gets the result of the first refresh: concurrent ones
 * wait for it, late ones (up to `reuseMs`, default 30 s) reuse it and set the same new cookies.
 * An "unavailable" outcome is not kept (the token was not spent).
 *
 * In-process: correct for the single Next.js instance this site runs as.
 */
export class RefreshSingleFlight {
  private readonly flights = new Map<string, Flight>();
  private readonly reuseMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(
    private readonly refresh: (refreshToken: string) => Promise<RefreshOutcome>,
    options: RefreshSingleFlightOptions = {},
  ) {
    this.reuseMs = options.reuseMs ?? 30_000;
    this.maxEntries = options.maxEntries ?? 1000;
    this.now = options.now ?? Date.now;
  }

  run(refreshToken: string): Promise<RefreshOutcome> {
    this.forgetOld();
    const existing = this.flights.get(refreshToken);
    if (existing) return existing.outcome;
    const outcome = this.refresh(refreshToken).catch((): RefreshOutcome => ({ kind: 'unavailable' }));
    this.remember(refreshToken, { outcome, startedAt: this.now() });
    void outcome.then(result => {
      if (result.kind === 'unavailable') this.flights.delete(refreshToken);
    });
    return outcome;
  }

  /** Remembered tokens (tests). */
  get size(): number {
    return this.flights.size;
  }

  private remember(refreshToken: string, flight: Flight): void {
    if (this.flights.size >= this.maxEntries) {
      const oldest = this.flights.keys().next();
      if (!oldest.done) this.flights.delete(oldest.value);
    }
    this.flights.set(refreshToken, flight);
  }

  private forgetOld(): void {
    const limit = this.now() - this.reuseMs;
    for (const [token, flight] of this.flights) {
      if (flight.startedAt < limit) this.flights.delete(token);
    }
  }
}
