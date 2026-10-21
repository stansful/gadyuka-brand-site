import { strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import { MoscowCalendar } from './moscow-calendar';

describe('MoscowCalendar (news dates and offer days, Moscow time)', () => {
  it('round-trips news and offer days through <input type="date">', () => {
    strictEqual(MoscowCalendar.dayOf(MoscowCalendar.noonOf('2026-10-01')), '2026-10-01');
    const until = MoscowCalendar.endOfDayOf('2026-10-31');
    strictEqual(MoscowCalendar.dayOf(until), '2026-10-31');
    strictEqual(until.toISOString(), '2026-10-31T20:59:59.999Z');
    strictEqual(MoscowCalendar.noonOf('2026-10-01').toISOString(), '2026-10-01T09:00:00.000Z');
  });

  it('names the Moscow day of a moment (21:30 UTC is already the next day in Moscow)', () => {
    strictEqual(MoscowCalendar.dayOf(new Date('2026-10-31T21:30:00.000Z')), '2026-11-01');
    strictEqual(MoscowCalendar.dayOf(new Date('2026-10-31T20:59:59.999Z')), '2026-10-31');
  });

  it('accepts real calendar days only (leap years included)', () => {
    for (const day of ['2026-01-31', '2028-02-29', '2000-02-29', '2026-04-30']) {
      strictEqual(MoscowCalendar.isDay(day), true, day);
    }
    for (const day of ['2026-02-29', '1900-02-29', '2026-04-31', '2026-13-01', '26-10-01', '2026-10-01T00:00', '']) {
      strictEqual(MoscowCalendar.isDay(day), false, day);
    }
  });
});
