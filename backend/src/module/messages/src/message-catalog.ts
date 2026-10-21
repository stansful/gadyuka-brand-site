import { join } from 'node:path';

import { LocaleMap } from '~core/locales/locale-map';
import { DEFAULT_LOCALE, Locale } from '~core/locales/locale.enum';

import { MessageFileLoader } from './message-file.loader';
import { FlatMessages, MessageTree } from './message-tree';
import { MessageTreeFlattener } from './message-tree.flattener';

/**
 * The bundled default messages (shared/messages, see MessagesDirectory), read once at startup:
 * - site messages, <locale>.json: the defaults of every site UI string and the source of the key
 *   set (the admin edits Message rows over them; ru.json defines the key order);
 * - admin messages, admin/ru.json: the admin UI copy — the backend answers with its keys.
 */
export class MessageCatalog {
  private static readonly ADMIN_FILE = join('admin', 'ru.json');

  private readonly siteTrees: Readonly<Record<Locale, MessageTree>>;
  private readonly siteFlat: Readonly<Record<Locale, FlatMessages>>;
  private readonly adminFlat: FlatMessages;

  constructor(directory: string) {
    const flattener = new MessageTreeFlattener();
    const loader = new MessageFileLoader(directory);
    this.siteTrees = LocaleMap.build(locale => loader.load(`${locale}.json`));
    this.siteFlat = LocaleMap.build(locale => flattener.flatten(this.siteTrees[locale]));
    this.adminFlat = flattener.flatten(loader.load(MessageCatalog.ADMIN_FILE));
  }

  /** Every site message key, in the order of ru.json (= the display order in the admin). */
  siteKeys(): readonly string[] {
    return Object.keys(this.siteFlat[DEFAULT_LOCALE]);
  }

  /** True for a string leaf of ru.json (a branch or an orphan key is not). */
  isSiteKey(key: string): boolean {
    return Object.hasOwn(this.siteFlat[DEFAULT_LOCALE], key);
  }

  /** The default value of a site key in `locale` ("" when the file lacks it). */
  siteDefault(key: string, locale: Locale): string {
    return this.siteFlat[locale][key] ?? '';
  }

  /** The site defaults of `locale`, flat. */
  siteDefaults(locale: Locale): FlatMessages {
    return this.siteFlat[locale];
  }

  /** The site defaults of `locale` as the nested tree (a deep copy). */
  siteTree(locale: Locale): MessageTree {
    return structuredClone(this.siteTrees[locale]);
  }

  /** An admin message by its full key ("admin.auth.throttled"), undefined when it does not exist. */
  findAdminMessage(key: string): string | undefined {
    return this.adminFlat[key];
  }
}
