import { SeedMediaOutcome } from './seed-media-outcome.enum';

/** Counters of one media seed (for its log line). */
export class SeedMediaStats {
  private readonly rows: Record<SeedMediaOutcome, number> = {
    [SeedMediaOutcome.CREATED]: 0,
    [SeedMediaOutcome.REUSED]: 0,
    [SeedMediaOutcome.KEPT]: 0,
  };
  private uploads = 0;

  countRow(outcome: SeedMediaOutcome): void {
    this.rows[outcome] += 1;
  }

  countUpload(): void {
    this.uploads += 1;
  }

  toLogContext(): Readonly<Record<string, number>> {
    return {
      created: this.rows[SeedMediaOutcome.CREATED],
      reused: this.rows[SeedMediaOutcome.REUSED],
      kept_older: this.rows[SeedMediaOutcome.KEPT],
      uploaded: this.uploads,
    };
  }
}
