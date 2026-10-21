import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

import { LeadFormRules, LeadFormValues } from '~core/leads/lead-form.rules';

/**
 * The «e-mail or phone» group rule of TAILORING / PARTNERSHIP, on the virtual field `contact`: reads the
 * form, not the field's own value.
 */
@ValidatorConstraint({ name: 'leadContact' })
export class LeadContactConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, { object }: ValidationArguments): boolean {
    const form: LeadFormValues = object;
    return LeadFormRules.hasEmailOrPhone(form);
  }
}
