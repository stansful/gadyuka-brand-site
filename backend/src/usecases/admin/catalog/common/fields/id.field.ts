import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsNotEmpty, IsUUID, ValidateIf } from 'class-validator';

import { MAX_PRODUCT_IMAGES } from '~core/catalog/catalog.constants';
import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { CatalogMessageKey } from '~core/constants/catalog-message-key.enum';
import { ValidationMessage } from '~exception';
import { TextTransform } from '~usecases/admin/common/fields/text.transform';

/**
 * Row ids in the body of the catalog forms (trimmed; "" → admin.validation.idRequired, not a UUID →
 * admin.validation.idInvalid). Validation order = the order of the decorators.
 */
export class IdField {
  private static readonly IMAGE_IDS_SCHEMA = {
    type: 'array',
    items: { type: 'string', format: 'uuid' },
    maxItems: MAX_PRODUCT_IMAGES,
    description: 'Media ids, the main photo first',
  } as const;
  private static readonly PHOTOS_TOO_MANY = ValidationMessage.of(CatalogMessageKey.VALIDATION_PHOTOS_TOO_MANY, {
    max: MAX_PRODUCT_IMAGES,
  });

  /** A required reference (the collection of a product). */
  static required(): PropertyDecorator {
    return applyDecorators(ApiProperty({ format: 'uuid' }), ...IdField.idChecks());
  }

  /** A picked media file, or null for none (cover, avatar, OG image). */
  static nullableMedia(): PropertyDecorator {
    return applyDecorators(
      ApiProperty({ type: String, format: 'uuid', nullable: true }),
      ValidateIf(IdField.isNotNull),
      ...IdField.idChecks(),
    );
  }

  /** The photos of a product in display order: ≤ 30, no repeats. */
  static productImages(): PropertyDecorator {
    return applyDecorators(
      ApiProperty(IdField.IMAGE_IDS_SCHEMA),
      Transform(TextTransform.trimEach),
      IsArray(ValidationMessage.of(AdminMessageKey.VALIDATION_INVALID)),
      ArrayMaxSize(MAX_PRODUCT_IMAGES, IdField.PHOTOS_TOO_MANY),
      ArrayUnique(ValidationMessage.of(CatalogMessageKey.VALIDATION_PHOTOS_DUPLICATE)),
      IsNotEmpty({ each: true, ...ValidationMessage.of(CatalogMessageKey.VALIDATION_ID_REQUIRED) }),
      IsUUID('all', { each: true, ...ValidationMessage.of(AdminMessageKey.VALIDATION_ID_INVALID) }),
    );
  }

  private static idChecks(): PropertyDecorator[] {
    return [
      Transform(TextTransform.trim),
      IsNotEmpty(ValidationMessage.of(CatalogMessageKey.VALIDATION_ID_REQUIRED)),
      IsUUID('all', ValidationMessage.of(AdminMessageKey.VALIDATION_ID_INVALID)),
    ];
  }

  private static isNotNull(_dto: object, value: unknown): boolean {
    return value !== null;
  }
}
