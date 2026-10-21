import { ApiPropertyOptions } from '@nestjs/swagger';

/** Swagger description of a LocalizedText value in an answer ({ "ru": "…", "en": "…" }). */
export class LocalizedTextSchema {
  static of(description: string): ApiPropertyOptions {
    return {
      description,
      type: 'object',
      additionalProperties: { type: 'string' },
      example: { ru: 'Меня запомнят', en: 'They will remember me' },
    };
  }
}
