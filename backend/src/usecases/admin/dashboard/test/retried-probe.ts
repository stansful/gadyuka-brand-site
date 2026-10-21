/**
 * Counters are global, and other e2e files write the same tables at the same time: a measurement that
 * met a concurrent write is taken again (a few times) before the test compares it.
 */
export class RetriedProbe {
  private static readonly ATTEMPTS = 5;

  static async until<T>(measure: () => Promise<T>, isExpected: (value: T) => boolean): Promise<T> {
    let value = await measure();
    for (let attempt = 1; attempt < RetriedProbe.ATTEMPTS && !isExpected(value); attempt += 1) {
      value = await measure();
    }
    return value;
  }
}
