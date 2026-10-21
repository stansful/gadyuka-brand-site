import { deepStrictEqual, ok, rejects, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import { Locale } from '~core/locales/locale.enum';
import { MessageCatalog, MessagesDirectory } from '~module/messages';
import { SITE_MESSAGES_CACHE_TTL_MS, SiteMessageResolver, SiteMessagesService } from '~module/site-messages';

import { InMemorySiteMessageRows } from './test/in-memory-site-message-rows';

const catalog = new MessageCatalog(MessagesDirectory.locate());
const ru = (key: string): string => catalog.siteDefault(key, Locale.RU);
const en = (key: string): string => catalog.siteDefault(key, Locale.EN);

/** A clock the test moves by hand. */
class ManualClock {
  private time = 1_000_000;

  now(): number {
    return this.time;
  }

  advance(milliseconds: number): void {
    this.time += milliseconds;
  }
}

describe('SiteMessageResolver (rows over the shared/messages defaults)', () => {
  const resolver = new SiteMessageResolver(catalog);

  it('uses the default of the locale when a key has no row, the row when it has one', () => {
    const values = resolver.resolve(Locale.EN, [{ key: 'hero.title', locale: 'en', value: 'Edited' }]);
    strictEqual(values['hero.title'], 'Edited');
    strictEqual(values['notFound.title'], en('notFound.title'));
    deepStrictEqual(Object.keys(values), catalog.siteKeys(), 'every key, in the order of ru.json');
  });

  it('keeps a blank default-locale row as "" (hidden on purpose)', () => {
    const values = resolver.resolve(Locale.RU, [{ key: 'offers.fine', locale: 'ru', value: '  ' }]);
    strictEqual(values['offers.fine'], '');
  });

  it('shows the resolved Russian value for a blank row of another locale', () => {
    const rows = [
      { key: 'hero.title', locale: 'en', value: '' },
      { key: 'hero.title', locale: 'ru', value: 'Русская правка' },
      { key: 'notFound.title', locale: 'en', value: ' ' },
      { key: 'offers.fine', locale: 'en', value: '' },
      { key: 'offers.fine', locale: 'ru', value: '' },
    ];
    const values = resolver.resolve(Locale.EN, rows);
    strictEqual(values['hero.title'], 'Русская правка');
    strictEqual(values['notFound.title'], ru('notFound.title'), 'no Russian row: the Russian default');
    strictEqual(values['offers.fine'], '', 'blank in both: hidden');
  });

  it('ignores orphan rows (keys that are no message of ru.json, branches) and other locales', () => {
    const rows = [
      { key: 'removed.key', locale: 'ru', value: 'x' },
      { key: 'forms.errors', locale: 'ru', value: 'branch' },
      { key: 'hero.title', locale: 'en', value: 'English only' },
    ];
    const values = resolver.resolve(Locale.RU, rows);
    strictEqual(Object.hasOwn(values, 'removed.key'), false);
    strictEqual(Object.hasOwn(values, 'forms.errors'), false);
    strictEqual(values['hero.title'], ru('hero.title'));
  });

  it('reads the default-locale rows too for another locale', () => {
    deepStrictEqual(resolver.localesToRead(Locale.RU), [Locale.RU]);
    deepStrictEqual(resolver.localesToRead(Locale.EN), [Locale.EN, Locale.RU]);
  });
});

describe('SiteMessagesService (cache)', () => {
  function create(): { service: SiteMessagesService; rows: InMemorySiteMessageRows; clock: ManualClock } {
    const rows = new InMemorySiteMessageRows();
    const clock = new ManualClock();
    return { service: new SiteMessagesService(rows, clock, catalog), rows, clock };
  }

  it('reads the rows once for concurrent and repeated calls', async () => {
    const { service, rows } = create();
    rows.replaceRows([{ key: 'hero.title', locale: 'ru', value: 'Один' }]);
    const [first, second] = await Promise.all([service.findValues(Locale.RU), service.findValues(Locale.RU)]);
    await service.findValues(Locale.RU);
    strictEqual(first['hero.title'], 'Один');
    strictEqual(first, second);
    strictEqual(rows.readCount, 1);
  });

  it('reads again after invalidate() and after the expiry', async () => {
    const { service, rows, clock } = create();
    await service.findValues(Locale.RU);
    rows.replaceRows([{ key: 'hero.title', locale: 'ru', value: 'После правки' }]);
    service.invalidate();
    strictEqual((await service.findValues(Locale.RU))['hero.title'], 'После правки');
    rows.replaceRows([{ key: 'hero.title', locale: 'ru', value: 'Сид' }]);
    clock.advance(SITE_MESSAGES_CACHE_TTL_MS + 1);
    strictEqual((await service.findValues(Locale.RU))['hero.title'], 'Сид');
    strictEqual(rows.readCount, 3);
  });

  it('does not cache a failed read and keeps the last snapshot', async () => {
    const { service, rows } = create();
    strictEqual(service.snapshotOf(Locale.RU)['hero.title'], ru('hero.title'), 'defaults before any read');
    rows.replaceRows([{ key: 'hero.title', locale: 'ru', value: 'Снимок' }]);
    await service.findValues(Locale.RU);
    service.invalidate();
    rows.failWith(new Error('database down'));
    await rejects(service.findValues(Locale.RU), /database down/);
    strictEqual(service.snapshotOf(Locale.RU)['hero.title'], 'Снимок');
    rows.failWith(undefined);
    await service.findValues(Locale.RU);
    strictEqual(rows.readCount, 3, 'the failure was not cached');
  });

  it('returns the nested tree of the locale', async () => {
    const { service } = create();
    const tree = await service.findTree(Locale.EN);
    const hero = tree.hero;
    ok(typeof hero === 'object');
    strictEqual(hero.title, en('hero.title'));
  });
});
