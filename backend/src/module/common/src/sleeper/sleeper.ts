import { setTimeout as delay } from 'node:timers/promises';

import { Injectable } from '@nestjs/common';

/** Waiting as a dependency, so retry loops can be tested without real delays. */
export interface ISleeper {
  sleep(milliseconds: number): Promise<void>;
}

@Injectable()
export class Sleeper implements ISleeper {
  async sleep(milliseconds: number): Promise<void> {
    await delay(milliseconds);
  }
}
