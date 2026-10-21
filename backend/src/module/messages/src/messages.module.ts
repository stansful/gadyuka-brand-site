import { Module } from '@nestjs/common';

import { MessageValueValidator } from './format/message-value.validator';
import { MessageCatalog } from './message-catalog';
import { MessageTreeFlattener } from './message-tree.flattener';
import { MessageFormatter } from './message.formatter';
import { MessagesDirectory } from './messages-directory';

@Module({
  providers: [
    { provide: MessageCatalog, useFactory: () => new MessageCatalog(MessagesDirectory.locate()) },
    {
      provide: MessageValueValidator,
      inject: [MessageCatalog],
      useFactory: (catalog: MessageCatalog) => new MessageValueValidator(catalog),
    },
    { provide: MessageFormatter, useFactory: () => new MessageFormatter() },
    { provide: MessageTreeFlattener, useFactory: () => new MessageTreeFlattener() },
  ],
  exports: [MessageCatalog, MessageValueValidator, MessageFormatter, MessageTreeFlattener],
})
export class MessagesModule {}
