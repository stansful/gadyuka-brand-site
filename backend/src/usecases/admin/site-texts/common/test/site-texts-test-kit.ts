import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LocaleMap } from '~core/locales/locale-map';
import { Locale } from '~core/locales/locale.enum';
import { SiteTextRegistry } from '~core/site-texts/site-text-registry';
import {
  MessageCatalog,
  MessageFormatter,
  MessagesDirectory,
  MessageTree,
  MessageValueValidator,
} from '~module/messages';

import { SiteTextDefinitions } from '../site-text-definitions';
import { SiteTextEntriesBuilder } from '../site-text-entries.builder';
import { SiteTextLabels } from '../site-text-labels';
import { SiteTextValueChecker } from '../site-text-value.checker';

/** The site-texts services of the slice over a messages catalog (the real shared/messages by default). */
export class SiteTextsTestKit {
  readonly registry = new SiteTextRegistry();
  readonly validator: MessageValueValidator;
  readonly definitions: SiteTextDefinitions;
  readonly labels: SiteTextLabels;
  readonly values: SiteTextValueChecker;
  readonly entries: SiteTextEntriesBuilder;

  constructor(readonly catalog: MessageCatalog = new MessageCatalog(MessagesDirectory.locate())) {
    this.validator = new MessageValueValidator(catalog);
    this.definitions = new SiteTextDefinitions(catalog, this.validator, this.registry);
    this.labels = new SiteTextLabels(catalog, new MessageFormatter());
    this.values = new SiteTextValueChecker(this.validator);
    this.entries = new SiteTextEntriesBuilder(this.definitions);
  }

  /**
   * A kit over a throw-away messages directory: `site` is written as every locale's file, `admin` as
   * admin/ru.json. Call `remove()` of the result when done.
   */
  static withMessages(site: MessageTree, admin: MessageTree): { kit: SiteTextsTestKit; remove: () => void } {
    const directory = mkdtempSync(join(tmpdir(), 'site-texts-'));
    mkdirSync(join(directory, 'admin'));
    LocaleMap.LOCALES.forEach(locale => writeFileSync(join(directory, `${locale}.json`), JSON.stringify(site)));
    writeFileSync(join(directory, 'admin', `${Locale.RU}.json`), JSON.stringify(admin));
    const kit = new SiteTextsTestKit(new MessageCatalog(directory));
    return { kit, remove: () => rmSync(directory, { recursive: true, force: true }) };
  }

  /** The default of a site key (fails the test when the key does not exist). */
  defaultOf(key: string, locale: Locale): string {
    const definition = this.definitions.find(key);
    if (definition === undefined) {
      throw new Error(`shared/messages/ru.json has no ${key}`);
    }
    return definition.defaults[locale];
  }

  /** The first site key matching `predicate` (keys are picked by property, so the tests follow copy changes). */
  firstKey(predicate: (key: string) => boolean, what: string): string {
    const key = this.catalog.siteKeys().find(predicate);
    if (key === undefined) {
      throw new Error(`shared/messages/ru.json has no ${what}`);
    }
    return key;
  }
}
