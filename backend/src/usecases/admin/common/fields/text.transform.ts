import { TransformFnParams } from 'class-transformer';

/**
 * Normalizations of submitted text before validation (class-transformer @Transform). Values of
 * another type pass through unchanged: the validators of the field refuse them.
 */
export class TextTransform {
  private static readonly DIGITS = /^\d{1,9}$/;

  static trim({ value }: TransformFnParams): unknown {
    return typeof value === 'string' ? value.trim() : value;
  }

  static trimToLowerCase({ value }: TransformFnParams): unknown {
    return typeof value === 'string' ? value.trim().toLowerCase() : value;
  }

  /** A query parameter of digits → its number (anything else stays a string: the validators refuse it). */
  static toWholeNumber({ value }: TransformFnParams): unknown {
    return typeof value === 'string' && TextTransform.DIGITS.test(value) ? Number(value) : value;
  }

  /** Every string of a list trimmed. */
  static trimEach({ value }: TransformFnParams): unknown {
    return Array.isArray(value) ? value.map((item: unknown) => (typeof item === 'string' ? item.trim() : item)) : value;
  }
}
