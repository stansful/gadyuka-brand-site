import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MessageTree } from './message-tree';
import { MessageTreeParser } from './message-tree.parser';

/** Reads and checks one JSON file of the messages directory. */
export class MessageFileLoader {
  private readonly parser = new MessageTreeParser();

  constructor(private readonly directory: string) {}

  load(fileName: string): MessageTree {
    const path = join(this.directory, fileName);
    return this.parser.parse(JSON.parse(readFileSync(path, 'utf8')), path);
  }
}
