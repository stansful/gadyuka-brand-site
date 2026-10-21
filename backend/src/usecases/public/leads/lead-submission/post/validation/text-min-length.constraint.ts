import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

/**
 * Text of at least `constraints[0]` UTF-16 code units — the way the site form counts (`minLength`,
 * `value.length`), unlike class-validator's MinLength (which counts an emoji as one character).
 * Non-text values fail (a type check before it reports them with its own key).
 */
@ValidatorConstraint({ name: 'textMinLength' })
export class TextMinLengthConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, { constraints }: ValidationArguments): boolean {
    const min: unknown = constraints[0];
    return typeof value === 'string' && typeof min === 'number' && value.length >= min;
  }
}
