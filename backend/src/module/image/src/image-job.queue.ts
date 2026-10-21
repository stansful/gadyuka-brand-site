import { Injectable } from '@nestjs/common';

import { MAX_CONCURRENT_IMAGE_JOBS } from '~core/media/media.constants';

/**
 * At most MAX_CONCURRENT_IMAGE_JOBS image jobs run at once (each may hold a large decoded image);
 * further jobs wait in a FIFO queue, so parallel uploads cannot exhaust the VPS memory.
 */
@Injectable()
export class ImageJobQueue {
  private activeJobs = 0;
  private readonly waitingJobs: Array<() => void> = [];

  async run<T>(job: () => Promise<T>): Promise<T> {
    await this.acquireSlot();
    try {
      return await job();
    } finally {
      this.releaseSlot();
    }
  }

  private async acquireSlot(): Promise<void> {
    if (this.activeJobs < MAX_CONCURRENT_IMAGE_JOBS) {
      this.activeJobs += 1;
      return;
    }
    // The releasing job hands its slot over directly (activeJobs stays the same).
    await new Promise<void>(resolve => this.waitingJobs.push(resolve));
  }

  private releaseSlot(): void {
    const next = this.waitingJobs.shift();
    if (next) {
      next();
      return;
    }
    this.activeJobs -= 1;
  }
}
