import { Type } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import { NestNodeApplication } from '@nestjs/platform-node';
import { StorageDisk, getDiskToken } from '@nestjs/storage';

import { ConfigService } from '~config';
import { DatabaseService } from '~database';
import { MEDIA_DISK } from '~module/storage';

import { AppFactory } from '../../app.factory';
import { ApiClient } from './api-client';

/**
 * The real application (AppFactory: NodeAdapter, guards, pipes, filters) on a random local port, against
 * the dev Postgres (database of .env.test) and MinIO. One per e2e file.
 */
export class TestApp {
  private constructor(
    private readonly app: NestNodeApplication,
    readonly api: ApiClient,
  ) {}

  static async start(): Promise<TestApp> {
    const app = await AppFactory.create();
    await app.listen(0, '127.0.0.1');
    const internalKey = app.get(ConfigService).getSafety('INTERNAL_API_KEY');
    return new TestApp(app, new ApiClient(await app.getUrl(), internalKey));
  }

  get database(): DatabaseService {
    return this.app.get(DatabaseService);
  }

  /** The module tree of the app (controllers and their route metadata, see RouteInventory). */
  get modules(): ModulesContainer {
    return this.app.get(ModulesContainer);
  }

  /** A provider of the app (e.g. a service whose cache a test drops). */
  get<T>(type: Type<T>): T {
    return this.app.get(type);
  }

  get mediaDisk(): StorageDisk {
    return this.app.get<StorageDisk>(getDiskToken(MEDIA_DISK));
  }

  async stop(): Promise<void> {
    await this.app.close();
  }
}
