import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  NotEquals,
  ValidateIf,
  ValidationOptions,
} from 'class-validator';

import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { ContentEntitiesMessageKey } from '~core/constants/content-entities-message-key.enum';
import { SLUG_MAX_LENGTH, SLUG_PATTERN } from '~core/constants/slug.constants';
import { HTTP_URL_MAX_LENGTH } from '~core/content-entities/content-limits.constants';
import { MoscowCalendar } from '~core/content-entities/moscow-calendar';
import { SiteHref } from '~core/links/site-href';
import { ValidationMessage } from '~exception';
import { TextTransform } from '~usecases/admin/common/fields/text.transform';

import { ContentValidators } from './content-validators';

/**
 * Body fields shared by the content entities — ports of the admin's zod schemas with their message
 * keys. Each method returns the property decorator (Swagger + transform + validators); the rules are
 * listed in the order they run, and the pipe reports the first failure of a field:
 *
 *   @ContentField.slug('Address of the news page')
 *   slug: string;
 */
export class ContentField {
  private static readonly TRIM = Transform(TextTransform.trim, { toClassOnly: true });

  /** Trimmed and lowercased; 1…120 of [a-z0-9] in hyphen-separated groups. */
  static slug(description: string): PropertyDecorator {
    const schema = { description, maxLength: SLUG_MAX_LENGTH, pattern: SLUG_PATTERN.source };
    return applyDecorators(
      ApiProperty({ ...schema, example: 'menya-zapomnyat' }),
      Transform(TextTransform.trimToLowerCase, { toClassOnly: true }),
      IsString(ValidationMessage.of(AdminMessageKey.VALIDATION_INVALID)),
      MinLength(1, ValidationMessage.of(ContentEntitiesMessageKey.VALIDATION_SLUG_REQUIRED)),
      MaxLength(SLUG_MAX_LENGTH, ContentField.tooLong(SLUG_MAX_LENGTH)),
      Matches(SLUG_PATTERN, ValidationMessage.of(ContentEntitiesMessageKey.VALIDATION_SLUG_FORMAT)),
    );
  }

  /** A media file id (trimmed UUID). */
  static mediaId(description: string): PropertyDecorator {
    return applyDecorators(ApiProperty({ description, format: 'uuid' }), ...ContentField.idRules());
  }

  /** A media file id or null (no picture). */
  static optionalMediaId(description: string): PropertyDecorator {
    return applyDecorators(
      ApiProperty({ description, format: 'uuid', type: String, nullable: true }),
      ContentField.nullable(),
      ...ContentField.idRules(),
    );
  }

  /** "YYYY-MM-DD", a real calendar day. */
  static calendarDay(description: string): PropertyDecorator {
    return applyDecorators(ApiProperty({ description, format: 'date' }), ...ContentField.dayRules());
  }

  static optionalCalendarDay(description: string): PropertyDecorator {
    return applyDecorators(
      ApiProperty({ description, format: 'date', type: String, nullable: true }),
      ContentField.nullable(),
      ...ContentField.dayRules(),
    );
  }

  /** A link of the site (SiteHref) or null: trimmed, ≤ 500. */
  static optionalSiteHref(description: string): PropertyDecorator {
    return applyDecorators(
      ApiProperty({ description, maxLength: SiteHref.MAX_LENGTH, type: String, nullable: true }),
      ContentField.TRIM,
      ContentField.nullable(),
      IsString(ValidationMessage.of(AdminMessageKey.VALIDATION_INVALID)),
      ...ContentField.siteHrefRules(),
    );
  }

  /** The link of a menu item: trimmed, required, a SiteHref, not a bare "#". */
  static menuHref(description: string): PropertyDecorator {
    return applyDecorators(
      ApiProperty({ description, maxLength: SiteHref.MAX_LENGTH, example: '#catalog' }),
      ContentField.TRIM,
      IsString(ValidationMessage.of(AdminMessageKey.VALIDATION_INVALID)),
      MinLength(1, ValidationMessage.of(ContentEntitiesMessageKey.VALIDATION_HREF_REQUIRED)),
      ...ContentField.siteHrefRules(),
      NotEquals(SiteHref.BARE_HASH, ValidationMessage.of(ContentEntitiesMessageKey.VALIDATION_HREF_BARE_HASH)),
    );
  }

  /** An http(s) link (HttpUrl), ≤ 500 as stored. */
  static httpUrl(description: string): PropertyDecorator {
    return applyDecorators(
      ApiProperty({ description, maxLength: HTTP_URL_MAX_LENGTH, example: 'https://t.me/gadyuka' }),
      ...ContentField.httpUrlRules(),
    );
  }

  static optionalHttpUrl(description: string): PropertyDecorator {
    return applyDecorators(
      ApiProperty({ description, maxLength: HTTP_URL_MAX_LENGTH, type: String, nullable: true }),
      ContentField.nullable(),
      ...ContentField.httpUrlRules(),
    );
  }

  static flag(description: string): PropertyDecorator {
    return applyDecorators(
      ApiProperty({ description }),
      IsBoolean(ValidationMessage.of(AdminMessageKey.VALIDATION_INVALID)),
    );
  }

  /** null skips the field's rules (undefined does not: the key is required). */
  private static nullable(): PropertyDecorator {
    return ValidateIf((_object: object, value: unknown) => value !== null);
  }

  private static idRules(): PropertyDecorator[] {
    const required = ValidationMessage.of(ContentEntitiesMessageKey.VALIDATION_ID_REQUIRED);
    return [
      ContentField.TRIM,
      IsString(required),
      MinLength(1, required),
      IsUUID('all', ValidationMessage.of(AdminMessageKey.VALIDATION_ID_INVALID)),
    ];
  }

  private static dayRules(): PropertyDecorator[] {
    const required = ValidationMessage.of(ContentEntitiesMessageKey.VALIDATION_DATE_REQUIRED);
    return [IsString(required), Matches(MoscowCalendar.DAY_PATTERN, required)];
  }

  private static siteHrefRules(): PropertyDecorator[] {
    return [
      MaxLength(SiteHref.MAX_LENGTH, ContentField.tooLong(SiteHref.MAX_LENGTH)),
      Matches(SiteHref.PATTERN, ValidationMessage.of(ContentEntitiesMessageKey.VALIDATION_SITE_HREF)),
    ];
  }

  private static httpUrlRules(): PropertyDecorator[] {
    const invalid = ValidationMessage.of(ContentEntitiesMessageKey.VALIDATION_HTTP_URL);
    return [
      IsString(invalid),
      ContentValidators.isHttpUrl(invalid),
      ContentValidators.maxHttpUrlLength(HTTP_URL_MAX_LENGTH, ContentField.tooLong(HTTP_URL_MAX_LENGTH)),
    ];
  }

  private static tooLong(max: number): ValidationOptions {
    return ValidationMessage.of(AdminMessageKey.VALIDATION_TOO_LONG, { max });
  }
}
