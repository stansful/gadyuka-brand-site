import { Injectable } from '@nestjs/common';

import { LocaleMap } from '~core/locales/locale-map';
import { Locale } from '~core/locales/locale.enum';
import { SiteTextKind } from '~core/site-texts/site-text-kind.enum';
import { SiteTextRegistry } from '~core/site-texts/site-text-registry';
import { MessageCatalog, MessageFormat, MessageValueValidator } from '~module/messages';

/** Everything the admin editor needs about one site text (static: the defaults never change at runtime). */
export interface SiteTextDefinition {
  /** "hero.title" */
  readonly key: string;
  /** Top-level namespace = the admin section ("hero") */
  readonly section: string;
  readonly kind: SiteTextKind;
  readonly required: boolean;
  /** shared/messages/<locale>.json of every locale (what «Вернуть по умолчанию» restores) */
  readonly defaults: Readonly<Record<Locale, string>>;
  /** {arguments} and <tags> of the defaults, merged over every locale (the code fills them in) */
  readonly format: MessageFormat;
}

/**
 * The site texts of the admin «Тексты сайта»: every string leaf of shared/messages/ru.json (in its
 * order, the admin namespace left out) with the registry metadata. Kind: the registry's override, else
 * "icu" when a default uses ICU syntax, else "text". Built once.
 */
@Injectable()
export class SiteTextDefinitions {
  private readonly definitions: readonly SiteTextDefinition[];
  private readonly definitionsByKey: ReadonlyMap<string, SiteTextDefinition>;

  constructor(
    private readonly catalog: MessageCatalog,
    private readonly validator: MessageValueValidator,
    private readonly registry: SiteTextRegistry,
  ) {
    this.definitions = this.buildDefinitions();
    this.definitionsByKey = new Map(this.definitions.map(definition => [definition.key, definition]));
  }

  /** Every site text, in the order of ru.json. */
  all(): readonly SiteTextDefinition[] {
    return this.definitions;
  }

  /** The site text of `key`; undefined for anything else (a branch, an orphan, an admin key). */
  find(key: string): SiteTextDefinition | undefined {
    return this.definitionsByKey.get(key);
  }

  /**
   * The sections that have texts: the registry's in the registry's order, then any namespace the
   * registry does not know yet (in key order).
   */
  sectionIds(): string[] {
    const present = new Set(this.definitions.map(definition => definition.section));
    const known = this.registry.sectionIds();
    return [...known.filter(id => present.has(id)), ...[...present].filter(id => !known.includes(id))];
  }

  private buildDefinitions(): SiteTextDefinition[] {
    return this.catalog
      .siteKeys()
      .filter(key => !this.registry.isAdminNamespace(this.sectionOf(key)))
      .map(key => this.define(key));
  }

  private define(key: string): SiteTextDefinition {
    const defaults = LocaleMap.build(locale => this.catalog.siteDefault(key, locale));
    return {
      key,
      section: this.sectionOf(key),
      kind: this.kindOf(key, defaults),
      required: this.registry.isRequired(key),
      defaults,
      format: this.validator.defaultFormat(key),
    };
  }

  private kindOf(key: string, defaults: Readonly<Record<Locale, string>>): SiteTextKind {
    const hasSyntax = Object.values(defaults).some(value => this.validator.hasSyntax(value));
    return this.registry.findKindOverride(key) ?? (hasSyntax ? SiteTextKind.ICU : SiteTextKind.TEXT);
  }

  /** "forms.errors.required" → "forms". */
  private sectionOf(key: string): string {
    const dot = key.indexOf('.');
    return dot === -1 ? key : key.slice(0, dot);
  }
}
