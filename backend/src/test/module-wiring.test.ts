import { ok } from 'node:assert';
import { describe, it } from 'node:test';

import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { ConfigService } from '~config';
import { DatabaseService } from '~database';
import { ImageModule, ImageProcessor } from '~module/image';
import { MessageValueValidator, MessagesModule } from '~module/messages';
import { SiteMessagesModule, SiteMessagesService } from '~module/site-messages';
import { TelegramLeadNotifier, TelegramModule } from '~module/telegram';
import { TestEnvironment } from '~test/test-environment';

/** The global ConfigService of the app, from a test environment, and a DatabaseService that is never connected. */
@Global()
@Module({
  providers: [
    { provide: ConfigService, useValue: new ConfigService(TestEnvironment.valid()) },
    { provide: DatabaseService, useValue: {} },
  ],
  exports: [ConfigService, DatabaseService],
})
class TestConfigModule {}

describe('module wiring (modules the endpoints of the next steps will import)', () => {
  it('resolves every provider of the telegram, image and messages modules', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TestConfigModule, TelegramModule, ImageModule, MessagesModule, SiteMessagesModule],
    }).compile();
    ok(moduleRef.get(TelegramLeadNotifier) instanceof TelegramLeadNotifier);
    ok(moduleRef.get(ImageProcessor) instanceof ImageProcessor);
    ok(moduleRef.get(MessageValueValidator) instanceof MessageValueValidator);
    ok(moduleRef.get(SiteMessagesService) instanceof SiteMessagesService);
    await moduleRef.close();
  });
});
