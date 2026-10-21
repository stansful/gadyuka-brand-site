import { Module } from '@nestjs/common';

import { AdminModule } from '~usecases/admin/admin.module';
import { AuthModule } from '~usecases/auth/auth.module';
import { PublicModule } from '~usecases/public/public.module';

@Module({
  imports: [PublicModule, AuthModule, AdminModule],
})
export class UsecaseModule {}
