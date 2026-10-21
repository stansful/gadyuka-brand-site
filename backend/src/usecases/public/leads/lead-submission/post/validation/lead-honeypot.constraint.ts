import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

import { LeadFormRules, LeadFormValues } from '~core/leads/lead-form.rules';

/** The honeypot is absent or text: a malformed one (null) is reported on `type` as an invalid form. */
@ValidatorConstraint({ name: 'leadHoneypot' })
export class LeadHoneypotConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, { object }: ValidationArguments): boolean {
    const form: LeadFormValues = object;
    return LeadFormRules.isHoneypotWellFormed(form);
  }
}
