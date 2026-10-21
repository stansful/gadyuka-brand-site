/** Conversions of raw environment strings for ConfigEnvironmentValidator (@Transform). */
export class EnvironmentValue {
  private static readonly TRUE_VALUES: ReadonlySet<string> = new Set(['1', 'true', 'yes', 'on']);
  private static readonly FALSE_VALUES: ReadonlySet<string> = new Set(['0', 'false', 'no', 'off']);

  /** "4000" → 4000; anything else is left for @IsInt() to reject. */
  static toInteger(value: unknown): unknown {
    if (typeof value !== 'string' || !/^-?\d+$/.test(value.trim())) {
      return value;
    }
    return Number.parseInt(value, 10);
  }

  /** "1" / "true" / "yes" / "on" → true, "0" / "false" / "no" / "off" → false; empty → true. */
  static toFlagDefaultingToTrue(value: unknown): unknown {
    return EnvironmentValue.toOptional(value) === undefined ? true : EnvironmentValue.toFlag(value);
  }

  /** Like toFlagDefaultingToTrue, empty → false. */
  static toFlagDefaultingToFalse(value: unknown): unknown {
    return EnvironmentValue.toOptional(value) === undefined ? false : EnvironmentValue.toFlag(value);
  }

  /** Empty variables ("S3_REGION=" in .env) count as missing. */
  static toOptional(value: unknown): unknown {
    if (typeof value !== 'string') {
      return value;
    }
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }

  static toText(value: unknown, fallback: string): unknown {
    return EnvironmentValue.toOptional(value) ?? fallback;
  }

  /** Anything but the known spellings is left for @IsBoolean() to reject. */
  private static toFlag(value: unknown): unknown {
    const text = String(EnvironmentValue.toOptional(value)).toLowerCase();
    if (EnvironmentValue.TRUE_VALUES.has(text)) {
      return true;
    }
    return EnvironmentValue.FALSE_VALUES.has(text) ? false : text;
  }
}
