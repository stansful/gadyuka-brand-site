import siteTextMetadata from '~shared/messages/meta/site-texts.json';

import { SiteTextKind } from './site-text-kind.enum';

/** One per-key override of shared/messages/meta/site-texts.json (`note`: why, for the reader only). */
interface SiteTextMetadataEntry {
  readonly kind?: string;
  /**
   * Must not be saved empty in the default locale (ru): headings (h1/h2, the targets of
   * aria-labelledby), buttons whose only other content is an aria-hidden arrow, links, the only
   * accessible name of a control (glyph / icon buttons, the logo link), of a dialog or of a navigation
   * landmark, and the error texts and states of the lead form. Other locales may be left blank: they
   * then show the Russian text.
   */
  readonly required?: boolean;
  readonly note?: string;
}

/** The shape of shared/messages/meta/site-texts.json. */
interface SiteTextMetadataFile {
  readonly sections: readonly string[];
  readonly texts: Readonly<Record<string, SiteTextMetadataEntry>>;
  /** Landing image key → the section whose texts it is edited with. */
  readonly images: Readonly<Record<string, string>>;
}

/**
 * Metadata of the editable site copy for the admin «Тексты сайта». THE KEY SET IS
 * shared/messages/ru.json: every string leaf is one site text, its top-level namespace is the admin
 * section. The metadata the JSON cannot say is shared/messages/meta/site-texts.json — the same file
 * the frontend reads (its landing image slots, its tests of what the site renders):
 * - sections: the display order of the namespaces (unit test: every namespace of ru.json is listed);
 * - texts: optional per-key overrides — kind, required (unit test: every key exists in ru.json);
 * - images: the landing images (ContentImage rows, not messages) and the section they are edited in.
 * The Russian admin names of sections, texts and images are admin copy (admin.siteTexts.sections /
 * labels / images in shared/messages/admin/ru.json).
 */
export class SiteTextRegistry {
  private static readonly METADATA: SiteTextMetadataFile = siteTextMetadata;

  /** Namespace of the admin UI strings (shared/messages/admin): never a site text. */
  private static readonly ADMIN_NAMESPACE = 'admin';

  /** The admin sections in display order. */
  sectionIds(): readonly string[] {
    return SiteTextRegistry.METADATA.sections;
  }

  /** True for the namespace of the admin UI strings (never listed as site texts). */
  isAdminNamespace(namespace: string): boolean {
    return namespace === SiteTextRegistry.ADMIN_NAMESPACE;
  }

  /** The kind override of a key (undefined: detected from its defaults). */
  findKindOverride(key: string): SiteTextKind | undefined {
    const kind = this.entryOf(key).kind;
    return kind === undefined ? undefined : this.toKind(kind);
  }

  /** Keys that must have text in the default locale. */
  isRequired(key: string): boolean {
    return this.entryOf(key).required === true;
  }

  /** Keys with metadata (each must be a key of shared/messages/ru.json). */
  metadataKeys(): string[] {
    return Object.keys(SiteTextRegistry.METADATA.texts);
  }

  /** Every landing image key, in registry order. */
  imageKeys(): string[] {
    return Object.keys(SiteTextRegistry.METADATA.images);
  }

  /** The landing images edited with the texts of `section`. */
  imageKeysOf(section: string): string[] {
    return this.imageKeys().filter(key => SiteTextRegistry.METADATA.images[key] === section);
  }

  isImageKey(key: string): boolean {
    return Object.hasOwn(SiteTextRegistry.METADATA.images, key);
  }

  private entryOf(key: string): SiteTextMetadataEntry {
    return Object.hasOwn(SiteTextRegistry.METADATA.texts, key) ? SiteTextRegistry.METADATA.texts[key] : {};
  }

  /** A kind name of the JSON as the enum (a name the backend does not know is a broken file). */
  private toKind(name: string): SiteTextKind {
    const kind = Object.values(SiteTextKind).find(candidate => candidate === name);
    if (kind === undefined) {
      throw new Error(`shared/messages/meta/site-texts.json: unknown kind "${name}"`);
    }
    return kind;
  }
}
