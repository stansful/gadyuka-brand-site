---
to: src/usecases/<%= base %>/<%= feature %>/<%= method %>/<%= feature %>.response.ts
---
import { ApiProperty } from '@nestjs/swagger';

/** Answer of <%= method.toUpperCase() %> /<%= group %>/<%= feature %>: implement its interface from shared/contracts. */
export class <%= h.changeCase.pascal(feature) %>Response {
  @ApiProperty({ description: 'Replace with the real fields' })
  example: string;
}
