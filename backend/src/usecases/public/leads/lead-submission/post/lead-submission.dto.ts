import { applyDecorators } from '@nestjs/common';
import { ApiHideProperty, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import { Allow, Equals, IsIn, IsNotEmpty, IsOptional, IsString, Matches, Validate, ValidateIf } from 'class-validator';

import type { LeadSubmitRequest } from '~shared/contracts/leads';

import { LeadsMessageKey } from '~core/constants/leads-message-key.enum';
import { LeadFormRules } from '~core/leads/lead-form.rules';
import { LeadType } from '~core/leads/lead-type';
import { LEAD_LIMITS } from '~core/leads/lead.constants';
import { Locale } from '~core/locales/locale.enum';
import { ValidationMessage } from '~exception';

import { LeadContactConstraint } from './validation/lead-contact.constraint';
import { LeadHoneypotConstraint } from './validation/lead-honeypot.constraint';
import { LeadPhoneConstraint } from './validation/lead-phone.constraint';
import { TextMaxLengthConstraint } from './validation/text-max-length.constraint';
import { TextMinLengthConstraint } from './validation/text-min-length.constraint';

/**
 * The e-mail pattern the site form has always accepted (zod 4's z.email() before): a dot-separated
 * local part of letters, digits and _'+-, a domain of letter/digit labels, an alphabetic TLD of 2+ letters.
 */
const EMAIL_PATTERN = /^(?:[\w'+-]+\.)*[\w'+-]*[\w+-]@(?:[A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;

const REQUIRED = ValidationMessage.of(LeadsMessageKey.REQUIRED);

/**
 * Body of POST /public/leads: the site's lead form as the visitor sent it (any JSON value). The checks
 * and keys port the site's own validator (frontend src/lib/leads.ts): every field reports the first
 * check it fails (forms.errors.*; the checks of a field run in the order of its applyDecorators list,
 * the pipe stops at the first failure); `contact` is the «e-mail or phone» error of TAILORING /
 * PARTNERSHIP. A filled honeypot skips every check (the usecase ignores the submission); an unknown
 * type skips the other fields (only `type` is reported). Strings are trimmed before the checks.
 */
export class LeadSubmissionDto implements LeadSubmitRequest {
  @ApiProperty({ enum: LeadType, example: LeadType.CONTACT })
  @ValidateIf(LeadFormRules.isTypeChecked)
  @applyDecorators(
    IsIn(LeadFormRules.TYPES, ValidationMessage.of(LeadsMessageKey.INVALID_TYPE)),
    Validate(LeadHoneypotConstraint, ValidationMessage.of(LeadsMessageKey.INVALID)),
  )
  type: LeadType;

  @ApiProperty({ minLength: LEAD_LIMITS.nameMin, maxLength: LEAD_LIMITS.nameMax, example: 'Иван Петров' })
  @ValidateIf(LeadFormRules.isFormChecked)
  @Transform(({ value }) => LeadFormRules.trimmed(value))
  @applyDecorators(
    IsString(REQUIRED),
    IsNotEmpty(REQUIRED),
    Validate(
      TextMinLengthConstraint,
      [LEAD_LIMITS.nameMin],
      ValidationMessage.of(LeadsMessageKey.TOO_SHORT, { min: LEAD_LIMITS.nameMin }),
    ),
    Validate(
      TextMaxLengthConstraint,
      [LEAD_LIMITS.nameMax],
      ValidationMessage.of(LeadsMessageKey.TOO_LONG, { max: LEAD_LIMITS.nameMax }),
    ),
  )
  name: string;

  @ApiPropertyOptional({
    maxLength: LEAD_LIMITS.emailMax,
    nullable: true,
    description: 'Required for CONTACT; TAILORING / PARTNERSHIP need an e-mail or a phone',
  })
  @ValidateIf(LeadFormRules.isEmailChecked)
  @Transform(({ value }) => LeadFormRules.trimmed(value))
  @applyDecorators(
    IsString({ ...REQUIRED, validateIf: LeadFormRules.isEmailRequired }),
    IsString({ ...ValidationMessage.of(LeadsMessageKey.INVALID_EMAIL), validateIf: LeadFormRules.isEmailOrPhoneForm }),
    IsNotEmpty(REQUIRED),
    Validate(
      TextMaxLengthConstraint,
      [LEAD_LIMITS.emailMax],
      ValidationMessage.of(LeadsMessageKey.TOO_LONG, { max: LEAD_LIMITS.emailMax }),
    ),
    Matches(EMAIL_PATTERN, ValidationMessage.of(LeadsMessageKey.INVALID_EMAIL)),
  )
  email?: string | null;

  @ApiPropertyOptional({ maxLength: LEAD_LIMITS.phoneMax, nullable: true, example: '+7 900 123-45-67' })
  @ValidateIf(LeadFormRules.isPhoneChecked)
  @Transform(({ value }) => LeadFormRules.trimmed(value))
  @applyDecorators(
    IsString(ValidationMessage.of(LeadsMessageKey.INVALID_PHONE)),
    Validate(
      TextMaxLengthConstraint,
      [LEAD_LIMITS.phoneMax],
      ValidationMessage.of(LeadsMessageKey.TOO_LONG, { max: LEAD_LIMITS.phoneMax }),
    ),
    Validate(LeadPhoneConstraint, ValidationMessage.of(LeadsMessageKey.INVALID_PHONE)),
  )
  phone?: string | null;

  @ApiPropertyOptional({ maxLength: LEAD_LIMITS.messageMax, nullable: true })
  @ValidateIf(LeadFormRules.isMessageChecked)
  @Transform(({ value }) => LeadFormRules.trimmed(value))
  @applyDecorators(
    IsString(ValidationMessage.of(LeadsMessageKey.INVALID)),
    Validate(
      TextMaxLengthConstraint,
      [LEAD_LIMITS.messageMax],
      ValidationMessage.of(LeadsMessageKey.TOO_LONG, { max: LEAD_LIMITS.messageMax }),
    ),
  )
  message?: string | null;

  @ApiPropertyOptional({ enum: Locale, description: 'Language of the page; anything else is stored as ru' })
  @Allow()
  locale?: Locale;

  @ApiProperty({ description: 'The personal data consent checkbox: must be true' })
  @ValidateIf(LeadFormRules.isFormChecked)
  @Equals(true, ValidationMessage.of(LeadsMessageKey.CONSENT_REQUIRED))
  consent: boolean;

  @ApiPropertyOptional({
    description: 'Honeypot: always "" or absent (a filled one = a bot: answered 201, not stored)',
  })
  @Allow()
  hp?: string;

  @ApiPropertyOptional({ description: "Page the form was sent from (the visitor's Referer); stored cut to 500" })
  @IsOptional()
  @IsString(ValidationMessage.of(LeadsMessageKey.INVALID))
  referer?: string;

  /** Not a form field: carries the «e-mail or phone» group error (`contact`) of TAILORING / PARTNERSHIP. */
  @ApiHideProperty()
  @ValidateIf(LeadFormRules.isContactGroupChecked)
  @Validate(LeadContactConstraint, ValidationMessage.of(LeadsMessageKey.CONTACT_REQUIRED))
  contact?: undefined;
}
