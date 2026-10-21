/**
 * Calendar days of the admin (news dates, the last day of an offer) — entered and shown in Moscow
 * time like the site, exchanged as "YYYY-MM-DD" (an <input type="date"> value).
 */
export class MoscowCalendar {
  /**
   * A real calendar day "YYYY-MM-DD" (leap years included) — the pattern of zod's z.iso.date(),
   * which the admin used before.
   */
  static readonly DAY_PATTERN =
    /^(?:(?:\d\d[2468][048]|\d\d[13579][26]|\d\d0[48]|[02468][048]00|[13579][26]00)-02-29|\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\d|30)|(?:02)-(?:0[1-9]|1\d|2[0-8])))$/;

  private static readonly UTC_OFFSET = '+03:00';
  private static readonly DAY_FORMAT = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  static isDay(value: string): boolean {
    return MoscowCalendar.DAY_PATTERN.test(value);
  }

  /** "2026-10-01" → noon Moscow time of that day (stable against time-zone shifts: news dates). */
  static noonOf(day: string): Date {
    return new Date(`${day}T12:00:00.000${MoscowCalendar.UTC_OFFSET}`);
  }

  /** "2026-10-31" → the last millisecond of that day in Moscow (an offer stays valid the whole day). */
  static endOfDayOf(day: string): Date {
    return new Date(`${day}T23:59:59.999${MoscowCalendar.UTC_OFFSET}`);
  }

  /** The Moscow calendar day of a moment: "YYYY-MM-DD". */
  static dayOf(moment: Date): string {
    return MoscowCalendar.DAY_FORMAT.format(moment);
  }
}
