import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import { Locale } from '~core/locales/locale.enum';
import { SiteTextKind } from '~core/site-texts/site-text-kind.enum';

import { SiteTextsTestKit } from './test/site-texts-test-kit';

/**
 * The registry metadata of the site copy (port of the frontend's src/lib/content/registry.test.ts):
 * consistent with shared/messages — every namespace listed, every override a real key, the kinds and
 * required flags the site relies on.
 */
describe('SiteTextRegistry + SiteTextDefinitions (shared/messages metadata)', () => {
  const kit = new SiteTextsTestKit();
  const keys = kit.catalog.siteKeys();

  function kindOf(key: string): SiteTextKind | undefined {
    return kit.definitions.find(key)?.kind;
  }

  function isRequired(key: string): boolean {
    return kit.definitions.find(key)?.required === true;
  }

  it('lists every namespace of ru.json as a section, once, in the registry order', () => {
    const namespaces = new Set(keys.map(key => key.slice(0, key.indexOf('.'))));
    const sections = kit.registry.sectionIds();
    strictEqual(new Set(sections).size, sections.length);
    deepStrictEqual([...namespaces].sort(), [...sections].sort());
    deepStrictEqual(kit.definitions.sectionIds(), sections);
  });

  it('has metadata only for real keys and keeps the landing images apart from the messages', () => {
    deepStrictEqual(
      kit.registry.metadataKeys().filter(key => !kit.catalog.isSiteKey(key)),
      [],
    );
    deepStrictEqual(
      kit.registry.imageKeys().filter(key => kit.catalog.isSiteKey(key)),
      [],
    );
    deepStrictEqual(kit.registry.imageKeysOf('about'), ['about.image']);
    deepStrictEqual(kit.registry.imageKeysOf('hero'), []);
    ok(kit.registry.isImageKey('tailoring.image'));
    strictEqual(kit.registry.isImageKey('toString'), false);
  });

  it('lists every text in the order of ru.json with its section and defaults', () => {
    deepStrictEqual(
      kit.definitions.all().map(definition => definition.key),
      keys,
    );
    deepStrictEqual(kit.definitions.find('about.advantages.0.title'), {
      key: 'about.advantages.0.title',
      section: 'about',
      kind: SiteTextKind.TEXT,
      required: false,
      defaults: { [Locale.RU]: 'Авторские модели', [Locale.EN]: 'Original designs' },
      format: { arguments: [], tags: [] },
    });
    strictEqual(kit.definitions.find('forms.errors'), undefined, 'a branch is no text');
  });

  it('knows every kind named in shared/messages/meta/site-texts.json', () => {
    const kinds: readonly string[] = Object.values(SiteTextKind);
    kit.registry.metadataKeys().forEach(key => ok([undefined, ...kinds].includes(kit.registry.findKindOverride(key))));
  });

  it('marks exactly the templates as ICU or simple templates (arguments, plural forms, tags)', () => {
    const icu = keys.filter(key => kindOf(key) === SiteTextKind.ICU);
    const simple = keys.filter(key => kindOf(key) === SiteTextKind.TEMPLATE);
    const templates = keys.filter(key => {
      const parsed = kit.validator.parseFormat(kit.defaultOf(key, Locale.RU));
      return parsed.ok && parsed.format.arguments.length + parsed.format.tags.length > 0;
    });
    deepStrictEqual([...icu, ...simple].sort(), [...templates].sort());
    ok(['catalog.models', 'hero.heading', 'telegram.newLead'].every(key => icu.includes(key)));
    // Filled in by the client components (fill / splitTemplate), so the admin may not use ICU formats there.
    deepStrictEqual(simple, [
      'gallery.counter',
      'contacts.form.subjectLine',
      'common.switchLanguageTo',
      'forms.errors.tooShort',
      'forms.errors.tooLong',
    ]);
    strictEqual(kindOf('catalog.text'), SiteTextKind.RICHTEXT);
    strictEqual(kindOf('hero.title'), SiteTextKind.TEXT);
  });

  it('requires the headings, buttons, accessible names and the lead form errors', () => {
    const chapters = ['catalog', 'about', 'tailoring', 'offers', 'news', 'gallery', 'reviews', 'partners', 'contacts'];
    chapters.forEach(chapter => ok(isRequired(`${chapter}.title`), chapter));
    const required = ['hero.title', 'header.cta', 'about.partnersCta', 'contacts.form.submit', 'brand.name'];
    required.forEach(key => ok(isRequired(key), key));
    const names = ['common.homeLink', 'common.openMenu', 'common.closeViewer', 'forms.sendAnother', 'forms.sending'];
    names.forEach(key => ok(isRequired(key), key));
    ['social.', 'telegram.', 'forms.errors.'].forEach(prefix =>
      ok(keys.filter(key => key.startsWith(prefix)).every(isRequired), prefix),
    );
    ['offers.fine', 'footer.trademark', 'forms.contactHint'].forEach(key => strictEqual(isRequired(key), false, key));
  });

  it('lists a namespace the registry does not know after its sections and never the admin namespace', () => {
    const { kit: custom, remove } = SiteTextsTestKit.withMessages(
      { zzzNew: { title: 'Новое' }, hero: { title: 'Г' }, admin: { title: 'Админ' } },
      { admin: {} },
    );
    try {
      deepStrictEqual(custom.definitions.sectionIds(), ['hero', 'zzzNew']);
      strictEqual(custom.definitions.find('admin.title'), undefined);
    } finally {
      remove();
    }
  });
});
