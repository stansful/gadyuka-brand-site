---
to: src/usecases/<%= base %>/<%= feature %>/<%= method %>/<%= feature %>.dto.ts
---
import { ApiProperty } from '@nestjs/swagger';

import { IsString, MaxLength } from 'class-validator';

import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { ValidationMessage } from '~exception';

const MAX_EXAMPLE_LENGTH = 200;

/** <%= method === 'get' ? 'Query' : 'Body' %> of <%= method.toUpperCase() %> /<%= group %>/<%= feature %>. Every field: a validator with a message key. */
export class <%= h.changeCase.pascal(feature) %>Dto {
  @ApiProperty({ description: 'Replace with the real fields', maxLength: MAX_EXAMPLE_LENGTH })
  @IsString(ValidationMessage.of(AdminMessageKey.VALIDATION_REQUIRED))
  @MaxLength(MAX_EXAMPLE_LENGTH, ValidationMessage.of(AdminMessageKey.VALIDATION_TOO_LONG, { max: MAX_EXAMPLE_LENGTH }))
  example: string;
}
