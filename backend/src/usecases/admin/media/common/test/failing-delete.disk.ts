import { InMemoryDisk } from '@nestjs/storage';

/** An in-memory disk whose deletes fail, like a storage that went down after the upload. */
export class FailingDeleteDisk extends InMemoryDisk {
  protected override async deleteObjects(): Promise<void> {
    throw new Error('storage is down');
  }
}
