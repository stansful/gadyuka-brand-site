import { ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

import { LeadPhoneNumber } from '~core/leads/lead-phone-number';

/** A text that normalizes to a phone number (LeadPhoneNumber: 10–15 digits, Russian conveniences). */
@ValidatorConstraint({ name: 'leadPhone' })
export class LeadPhoneConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && LeadPhoneNumber.findNormalized(value) !== undefined;
  }
}
