import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

/**
 * Text of at most `constraints[0]` UTF-16 code units — the way the site form counts (`maxLength`,
 * `value.length`), unlike class-validator's MaxLength (which counts an emoji as one character).
 * Non-text values fail (a type check before it reports them with its own key).
 */
@ValidatorConstraint({ name: 'textMaxLength' })
export class TextMaxLengthConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, { constraints }: ValidationArguments): boolean {
    const max: unknown = constraints[0];
    return typeof value === 'string' && typeof max === 'number' && value.length <= max;
  }
}
