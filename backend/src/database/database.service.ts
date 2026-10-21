import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { PrismaPg } from '@prisma/adapter-pg';

import { ConfigService } from '~config';
import { PrismaClient } from '~prisma-generated/prisma/client';

import { PostgresUrl } from './postgres-url';

/** The Prisma client (driver adapter `pg`), connected for the lifetime of the app. */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  /** One small VPS, one app instance: a few connections are plenty. */
  private readonly MAX_POOL_SIZE: number = 10;
  private readonly prismaClient: PrismaClient;

  constructor(private readonly config: ConfigService) {
    const connectionString = this.buildConnectionString();
    const adapter = new PrismaPg({ connectionString, max: this.MAX_POOL_SIZE });
    this.prismaClient = new PrismaClient({ adapter });
  }

  get client(): PrismaClient {
    return this.prismaClient;
  }

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }

  private buildConnectionString(): string {
    return new PostgresUrl({
      host: this.config.getSafety('POSTGRES_HOST'),
      port: this.config.getSafety('POSTGRES_PORT'),
      user: this.config.getSafety('POSTGRES_USER'),
      password: this.config.getSafety('POSTGRES_PASS'),
      database: this.config.getSafety('POSTGRES_NAME'),
    }).toString();
  }
}
