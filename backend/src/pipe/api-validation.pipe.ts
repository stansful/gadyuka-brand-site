import { Injectable, ValidationPipe } from '@nestjs/common';

import { ValidationErrorMapper, ValidationFailedException } from '~exception';

/**
 * Global DTO validation (class-validator): unknown fields are refused, values are converted to the
 * DTO classes, and errors become ValidationFailedException → 400 { error: 'validation', fields }
 * with message keys (one per field: validation stops at the first failed rule).
 */
@Injectable()
export class ApiValidationPipe extends ValidationPipe {
  constructor() {
    const mapper = new ValidationErrorMapper();
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: true,
      exceptionFactory: errors => new ValidationFailedException(mapper.map(errors)),
    });
  }
}
