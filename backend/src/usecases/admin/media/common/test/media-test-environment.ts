import { InMemoryDisk } from '@nestjs/storage';

import { ConfigService } from '~config';
import { MediaKeys, MediaStorage } from '~module/storage';
import { TestEnvironment } from '~test/test-environment';

/** Media storage over an in-memory disk with the test configuration (bucket "gadyuka-media"). */
export class MediaTestEnvironment {
  readonly config = new ConfigService(TestEnvironment.valid());

  constructor(readonly disk: InMemoryDisk = new InMemoryDisk()) {}

  get bucket(): string {
    return this.config.getSafety('S3_BUCKET');
  }

  createStorage(): MediaStorage {
    return new MediaStorage(this.disk, new MediaKeys(), this.config);
  }
}
