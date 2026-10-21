import { Inject, Injectable } from '@nestjs/common';

import { Locale } from '~core/locales/locale.enum';
import { IClock } from '~module/common';
import { FlatMessages, MessageCatalog, MessageTree, MessageTreeFlattener } from '~module/messages';

import { SiteMessageResolver } from './site-message.resolver';
import { SITE_MESSAGE_ROWS, SITE_MESSAGES_CACHE_TTL_MS, SITE_MESSAGES_CLOCK } from './site-messages.constants';
import { ISiteMessageRows } from './site-messages.interfaces';

interface CachedMessages {
  readonly values: Promise<FlatMessages>;
  readonly expiresAt: number;
}

/**
 * The site messages as the site shows them: admin-edited Message rows over the shared/messages
 * defaults (SiteMessageResolver), per locale, cached in the process.
 *
 * - `findValues` / `findTree`: the resolved messages; concurrent callers share one database read,
 *   a failed read is not cached (the next call tries again);
 * - `invalidate()`: drops the cache — the admin texts slice calls it after every write of Message
 *   rows (and the frontend then refreshes its own cache, updateTag('content'));
 * - `snapshotOf`: the last values read, synchronously (the defaults before the first read) — for
 *   formatters that cannot await (Telegram texts: `TelegramTexts.load()` refreshes it first).
 */
@Injectable()
export class SiteMessagesService {
  private readonly cache = new Map<Locale, CachedMessages>();
  private readonly snapshots = new Map<Locale, FlatMessages>();

  constructor(
    @Inject(SITE_MESSAGE_ROWS) private readonly rows: ISiteMessageRows,
    @Inject(SITE_MESSAGES_CLOCK) private readonly clock: IClock,
    private readonly catalog: MessageCatalog,
  ) {}

  /** { "hero.title": "…", … } — every site message of `locale`, in the order of ru.json. */
  findValues(locale: Locale): Promise<FlatMessages> {
    const cached = this.cache.get(locale);
    if (cached !== undefined && cached.expiresAt > this.clock.now()) {
      return cached.values;
    }
    return this.load(locale);
  }

  /** The same messages as the nested tree of shared/messages/<locale>.json (next-intl's shape). */
  async findTree(locale: Locale): Promise<MessageTree> {
    return new MessageTreeFlattener().unflatten(await this.findValues(locale));
  }

  /** The last resolved values of `locale` (its defaults until the first successful read). */
  snapshotOf(locale: Locale): FlatMessages {
    return this.snapshots.get(locale) ?? this.catalog.siteDefaults(locale);
  }

  /** Forget every cached locale: the next read loads the rows again. */
  invalidate(): void {
    this.cache.clear();
  }

  private load(locale: Locale): Promise<FlatMessages> {
    const values = this.read(locale);
    this.cache.set(locale, { values, expiresAt: this.clock.now() + SITE_MESSAGES_CACHE_TTL_MS });
    values.then(
      resolved => this.snapshots.set(locale, resolved),
      () => this.forgetFailedRead(locale, values),
    );
    return values;
  }

  private async read(locale: Locale): Promise<FlatMessages> {
    const resolver = new SiteMessageResolver(this.catalog);
    return resolver.resolve(locale, await this.rows.findByLocales(resolver.localesToRead(locale)));
  }

  /** A failed read stays the caller's error (it is returned to them) and is not served from the cache. */
  private forgetFailedRead(locale: Locale, values: Promise<FlatMessages>): void {
    if (this.cache.get(locale)?.values === values) {
      this.cache.delete(locale);
    }
  }
}
