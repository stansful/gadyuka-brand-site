import { join } from 'node:path';

import { LocaleMap } from '~core/locales/locale-map';
import { MessageFileLoader, MessageTreeFlattener } from '~module/messages';

import { SeedCopy } from './seed-copy';

/** Reads shared/messages/content/<locale>.json of every locale into a SeedCopy. */
export class SeedCopyLoader {
  private static readonly CONTENT_FOLDER = 'content';

  constructor(private readonly messagesDirectory: string) {}

  load(): SeedCopy {
    const loader = new MessageFileLoader(join(this.messagesDirectory, SeedCopyLoader.CONTENT_FOLDER));
    const flattener = new MessageTreeFlattener();
    return new SeedCopy(LocaleMap.build(locale => flattener.flatten(loader.load(`${locale}.json`))));
  }
}
