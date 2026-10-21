import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

import { CATALOG_TEXT_LIMITS, EMAIL_PATTERN, PHONE_PATTERN, PRICE_MAX } from '~core/catalog/catalog.constants';
import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { CatalogMessageKey } from '~core/constants/catalog-message-key.enum';
import { SLUG_MAX_LENGTH, SLUG_PATTERN } from '~core/constants/slug.constants';
import { ReviewRatingScale } from '~core/reviews/review-rating-scale';
import { ValidationMessage } from '~exception';
import { TextTransform } from '~usecases/admin/common/fields/text.transform';

/**
 * The plain fields of the catalog forms, validated like the old zod schemas (same order of checks,
 * so the same first message per field). Validation order = the order of the decorators.
 */
export class CatalogField {
  private static readonly INVALID = ValidationMessage.of(AdminMessageKey.VALIDATION_INVALID);
  private static readonly RATING_RANGE = { min: ReviewRatingScale.LIMIT.MIN, max: ReviewRatingScale.LIMIT.MAX };

  /** URL slug: trimmed and lower-cased, required, ≤ 120, a-z 0-9 and single hyphens. */
  static slug(): PropertyDecorator {
    return applyDecorators(
      ApiProperty({ maxLength: SLUG_MAX_LENGTH, pattern: SLUG_PATTERN.source, example: 'menya-zapomnyat' }),
      Transform(TextTransform.trimToLowerCase),
      IsString(CatalogField.INVALID),
      IsNotEmpty(ValidationMessage.of(CatalogMessageKey.VALIDATION_SLUG_REQUIRED)),
      MaxLength(SLUG_MAX_LENGTH, ValidationMessage.of(AdminMessageKey.VALIDATION_TOO_LONG, { max: SLUG_MAX_LENGTH })),
      Matches(SLUG_PATTERN, ValidationMessage.of(CatalogMessageKey.VALIDATION_SLUG_FORMAT)),
    );
  }

  static published(): PropertyDecorator {
    return applyDecorators(ApiProperty({ description: 'Shown on the site' }), IsBoolean(CatalogField.INVALID));
  }

  /** Whole rubles 0 … PRICE_MAX, or null (price on request). */
  static price(): PropertyDecorator {
    const integer = ValidationMessage.of(CatalogMessageKey.VALIDATION_PRICE_INTEGER);
    return applyDecorators(
      ApiProperty({ type: Number, nullable: true, minimum: 0, maximum: PRICE_MAX }),
      ValidateIf(CatalogField.isNotNull),
      IsNumber({ allowNaN: false, allowInfinity: false }, integer),
      Min(0, ValidationMessage.of(CatalogMessageKey.VALIDATION_PRICE_NEGATIVE)),
      Max(PRICE_MAX, ValidationMessage.of(CatalogMessageKey.VALIDATION_PRICE_TOO_HIGH, { max: PRICE_MAX })),
      IsInt(integer),
    );
  }

  /** Review rating 1 … 10 or null; the current scale (settings) is checked by the usecase. */
  static rating(): PropertyDecorator {
    const { MIN, MAX } = ReviewRatingScale.LIMIT;
    return applyDecorators(
      ApiProperty({ type: Number, nullable: true, minimum: MIN, maximum: MAX }),
      ValidateIf(CatalogField.isNotNull),
      IsInt(ValidationMessage.of(CatalogMessageKey.VALIDATION_RATING_INTEGER)),
      Min(MIN, ValidationMessage.of(CatalogMessageKey.VALIDATION_RATING_TOO_LOW, { min: MIN })),
      Max(MAX, ValidationMessage.of(CatalogMessageKey.VALIDATION_RATING_TOO_HIGH, { max: MAX })),
    );
  }

  /** The star scale of the settings: an integer 1 … 10. */
  static ratingScale(): PropertyDecorator {
    const range = ValidationMessage.of(CatalogMessageKey.VALIDATION_STARS_RANGE, CatalogField.RATING_RANGE);
    return applyDecorators(
      ApiProperty({ minimum: ReviewRatingScale.LIMIT.MIN, maximum: ReviewRatingScale.LIMIT.MAX }),
      IsInt(ValidationMessage.of(CatalogMessageKey.VALIDATION_STARS_INTEGER)),
      Min(ReviewRatingScale.LIMIT.MIN, range),
      Max(ReviewRatingScale.LIMIT.MAX, range),
    );
  }

  /** The author of a review: trimmed, required, ≤ 120. */
  static author(): PropertyDecorator {
    const max = CATALOG_TEXT_LIMITS.REVIEW_AUTHOR;
    return applyDecorators(
      ApiProperty({ maxLength: max, example: 'Сергей' }),
      Transform(TextTransform.trim),
      IsString(CatalogField.INVALID),
      IsNotEmpty(ValidationMessage.of(CatalogMessageKey.VALIDATION_AUTHOR_REQUIRED)),
      MaxLength(max, ValidationMessage.of(AdminMessageKey.VALIDATION_TOO_LONG, { max })),
    );
  }

  /** The site phone: trimmed, ≤ 40, digits / spaces / + ( ) . - ("" = none). */
  static phone(): PropertyDecorator {
    const max = CATALOG_TEXT_LIMITS.PHONE;
    return applyDecorators(
      ApiProperty({ maxLength: max, example: '+7 900 000-00-00' }),
      Transform(TextTransform.trim),
      IsString(CatalogField.INVALID),
      MaxLength(max, ValidationMessage.of(AdminMessageKey.VALIDATION_TOO_LONG, { max })),
      Matches(PHONE_PATTERN, ValidationMessage.of(CatalogMessageKey.VALIDATION_PHONE_FORMAT)),
    );
  }

  /** The site e-mail: "" (none) or an address ≤ 200 (not trimmed, like the old schema). */
  static email(): PropertyDecorator {
    const max = CATALOG_TEXT_LIMITS.EMAIL;
    return applyDecorators(
      ApiProperty({ maxLength: max, example: 'hello@example.ru', description: '"" = none' }),
      ValidateIf(CatalogField.isFilled),
      IsString(CatalogField.INVALID),
      Matches(EMAIL_PATTERN, ValidationMessage.of(CatalogMessageKey.VALIDATION_EMAIL)),
      MaxLength(max, ValidationMessage.of(AdminMessageKey.VALIDATION_TOO_LONG, { max })),
    );
  }

  private static isNotNull(_dto: object, value: unknown): boolean {
    return value !== null;
  }

  private static isFilled(_dto: object, value: unknown): boolean {
    return value !== '';
  }
}
