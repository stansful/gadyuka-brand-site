import { Injectable } from '@nestjs/common';

/** The current time as a dependency, so expiry rules (caches, TTLs) can be tested without waiting. */
export interface IClock {
  /** Milliseconds since the epoch */
  now(): number;
}

@Injectable()
export class Clock implements IClock {
  now(): number {
    return Date.now();
  }
}
