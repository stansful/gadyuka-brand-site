import { ApiProperty } from '@nestjs/swagger';

import type { AuthMeResponse } from '~shared/contracts/auth';

import { UserRole } from '~core/users/user-role';

export class MeResponse implements AuthMeResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: String, nullable: true, example: 'admin' })
  login: string | null;

  @ApiProperty({ example: 'Администратор' })
  name: string;

  @ApiProperty({ enum: UserRole })
  role: UserRole;

  @ApiProperty({ format: 'uuid', description: 'The current session (sid claim)' })
  sessionId: string;
}
