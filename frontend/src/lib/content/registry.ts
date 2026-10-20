import type { Locale } from '@/i18n/locales';
import { hasMessageSyntax } from '@/i18n/message-format';
import {
  MESSAGE_KEYS,
  defaultMessageTranslations,
  isMessageKey,
  messageNamespace,
  type MessageKey,
  type MessageNamespace,
} from '@/i18n/messages';

/**
 * Metadata registry of the editable site copy, for the admin «Тексты сайта» editor.
 *
 * THE KEY SET IS messages/ru.json: every string leaf is one `Message` (key = dotted path,
 * e.g. "hero.title"), and its top-level namespace is the admin section it is listed in. This
 * file never lists keys again — it only adds what the JSON cannot say:
 * - CONTENT_SECTIONS: the display order of every namespace (TypeScript fails when a namespace
 *   of ru.json has no entry);
 * - MESSAGE_META: optional per-key overrides — kind, `required`;
 * - CONTENT_IMAGES: the landing images (ContentImage rows, not messages).
 * The Russian admin names of the sections, texts and images are admin copy:
 * admin.siteTexts.sections / labels / images in messages/admin/ru.json (src/lib/admin/site-texts.ts).
 *
 * Isomorphic (no server-only imports): safe in admin client components and in prisma/seed.ts.
 *
 * To add copy: add the key to messages/<locale>.json (every locale; key-parity test), give it
 * an admin label in messages/admin/ru.json (admin.siteTexts.labels.<key>) if the key alone is
 * not clear, render it on the site, run `npm run db:seed`.
 * Keys removed from the JSON are no longer shown or rendered; their old rows stay in the DB
 * (the seed reports them as orphans and never deletes content).
 */

/**
 * Admin sections = the top-level namespaces of messages/ru.json, in the admin's order: the page
 * from top to bottom, then the shared and system copy (names: admin.siteTexts.sections.<id>).
 */
export const CONTENT_SECTIONS = [
  { id: 'header' },
  { id: 'hero' },
  { id: 'catalog' },
  { id: 'about' },
  { id: 'tailoring' },
  { id: 'offers' },
  { id: 'news' },
  { id: 'gallery' },
  { id: 'reviews' },
  { id: 'partners' },
  { id: 'contacts' },
  { id: 'footer' },
  { id: 'brand' },
  { id: 'common' },
  { id: 'forms' },
  { id: 'social' },
  { id: 'notFound' },
  { id: 'error' },
  { id: 'telegram' },
] as const satisfies ReadonlyArray<{ id: MessageNamespace }>;

/** An admin «Контент» section = a top-level namespace of the site messages. */
export type SectionId = (typeof CONTENT_SECTIONS)[number]['id'];

/** Compile-time check: every namespace of messages/ru.json has a section entry above. */
type UnlistedNamespace = Exclude<MessageNamespace, SectionId>;
const everyNamespaceListed: [UnlistedNamespace] extends [never] ? true : UnlistedNamespace = true;
void everyNamespaceListed;

export function isSectionId(value: unknown): value is SectionId {
  return typeof value === 'string' && CONTENT_SECTIONS.some(section => section.id === value);
}

/** Section anchors live in ./anchors (tiny, imported by client components); re-exported here. */
export { LEAD_FORM_ANCHOR, SECTION_ANCHORS } from './anchors';

/**
 * Landing chapters in page order (the owner's): «Глава 01» = catalog, 02 about, [the red band],
 * 03 tailoring, 04 offers, 05 news, 06 gallery, 07 reviews, 08 partners, «Глава 09» = contacts.
 * Chapter numbers, folios («— 02 —») and the red band position are derived from this list,
 * so they always follow the actual order of the sections.
 */
export const CHAPTER_ORDER = [
  'catalog',
  'about',
  'tailoring',
  'offers',
  'news',
  'gallery',
  'reviews',
  'partners',
  'contacts',
] as const satisfies ReadonlyArray<SectionId>;

export type ChapterId = (typeof CHAPTER_ORDER)[number];

/** "02" for about. */
export function chapterNumber(id: ChapterId): string {
  return String(CHAPTER_ORDER.indexOf(id) + 1).padStart(2, '0');
}

// ── messages ────────────────────────────────────────────────────────────────

/** Re-exported for the content layer: a site message key ("hero.title"). */
export type { MessageKey, MessageNamespace };
export { MESSAGE_KEYS, isMessageKey };

/**
 * Key of a landing text: texts["hero.title"]. Same as MessageKey (the landing reads every
 * site message); the name is kept for the site sections.
 */
export type TextKey = MessageKey;
/** All site message keys (= MESSAGE_KEYS), the keys of LandingContent.texts. */
export const TEXT_KEYS: readonly TextKey[] = MESSAGE_KEYS;

/**
 * How the admin edits a message and how the site uses it:
 * - text     — one line of plain text;
 * - richtext — plain text with paragraphs separated by an empty line (no HTML);
 * - icu      — an ICU template with {arguments}, plural forms or <tags> filled in by the code
 *              on the server (next-intl t(), formatText / formatNodes);
 * - template — a simple template the public CLIENT components fill in themselves, without an
 *              ICU runtime (fill / splitTemplate in src/components/site/labels.ts): plain text
 *              with the default's bare {arguments} and <tags> — no plural forms or formats;
 * - link     — a URL or an in-page anchor.
 * Edits of "icu" and "template" texts are validated with validateMessageValue from
 * @/i18n/message-format (syntax "template" for the latter).
 * Default: "icu" when a default value contains ICU syntax, otherwise "text" — a key the client
 * fills in must be listed below as "template".
 */
export type MessageKind = 'text' | 'richtext' | 'icu' | 'template' | 'link';

type MessageMeta = {
  readonly kind?: MessageKind;
  /**
   * Must not be saved empty in the default locale (ru): headings (h1/h2, the targets of
   * aria-labelledby), buttons whose only other content is an aria-hidden arrow, links, the
   * only accessible name of a control (glyph / icon buttons, the logo link), of a dialog or of
   * a navigation landmark, and the error texts and states of the lead form.
   * Other locales may be left blank: they then show the Russian text.
   */
  readonly required?: true;
};

const REQUIRED = { required: true } as const;
const TEMPLATE = { kind: 'template' } as const;
const REQUIRED_TEMPLATE = { kind: 'template', required: true } as const;

/**
 * Per-key overrides. Keys must exist in messages/ru.json (checked by TypeScript); a key without
 * an entry is optional, with an auto-detected kind.
 */
const MESSAGE_META: { readonly [K in MessageKey]?: MessageMeta } = {
  // ── header ────────────────────────────────────────────────────────────────
  'header.cta': REQUIRED,

  // ── hero ──────────────────────────────────────────────────────────────────
  'hero.title': REQUIRED,
  'hero.heading': REQUIRED,

  // ── catalog ───────────────────────────────────────────────────────────────
  'catalog.title': REQUIRED,
  'catalog.text': { kind: 'richtext' },
  'catalog.collectionTitle': REQUIRED,
  'catalog.openCollection': REQUIRED,
  'catalog.orderCta': REQUIRED,
  'catalog.breadcrumbHome': REQUIRED,
  'catalog.breadcrumbCatalog': REQUIRED,

  // ── about ─────────────────────────────────────────────────────────────────
  'about.title': REQUIRED,
  'about.text': { kind: 'richtext' },
  'about.cta': REQUIRED,
  'about.partnersCta': REQUIRED,

  // ── tailoring ─────────────────────────────────────────────────────────────
  'tailoring.title': REQUIRED,
  'tailoring.text': { kind: 'richtext' },
  'tailoring.cta': REQUIRED,
  'tailoring.steps.0.text': { kind: 'richtext' },
  'tailoring.steps.1.text': { kind: 'richtext' },
  'tailoring.steps.2.text': { kind: 'richtext' },

  // ── offers ────────────────────────────────────────────────────────────────
  'offers.title': REQUIRED,
  'offers.text': { kind: 'richtext' },

  // ── news ──────────────────────────────────────────────────────────────────
  'news.title': REQUIRED,
  'news.text': { kind: 'richtext' },
  'news.readMore': REQUIRED,

  // ── gallery ───────────────────────────────────────────────────────────────
  'gallery.title': REQUIRED,
  'gallery.text': { kind: 'richtext' },
  'gallery.counter': TEMPLATE, // GalleryScene: fill()

  // ── reviews ───────────────────────────────────────────────────────────────
  'reviews.title': REQUIRED,
  'reviews.text': { kind: 'richtext' },

  // ── partners ──────────────────────────────────────────────────────────────
  'partners.title': REQUIRED,
  'partners.text': { kind: 'richtext' },
  'partners.cta': REQUIRED,

  // ── contacts ──────────────────────────────────────────────────────────────
  'contacts.title': REQUIRED,
  'contacts.text': { kind: 'richtext' },
  'contacts.form.title': REQUIRED,
  'contacts.form.subjectLine': TEMPLATE, // LeadForm: splitTemplate(…, '{subject}')
  'contacts.form.topicLabel': REQUIRED,
  'contacts.form.topics.contact': REQUIRED,
  'contacts.form.topics.tailoring': REQUIRED,
  'contacts.form.topics.partnership': REQUIRED,
  'contacts.form.emailLabel': REQUIRED,
  'contacts.form.nameLabel': REQUIRED,
  'contacts.form.phoneLabel': REQUIRED,
  'contacts.form.commentLabel': REQUIRED,
  'contacts.form.consent': REQUIRED,
  'contacts.form.submit': REQUIRED,
  'contacts.form.success': REQUIRED,

  // ── footer ────────────────────────────────────────────────────────────────
  'footer.top': REQUIRED,

  // ── brand ─────────────────────────────────────────────────────────────────
  'brand.name': REQUIRED,
  'brand.pageTitle': REQUIRED,

  // ── common ────────────────────────────────────────────────────────────────
  'common.skipToContent': REQUIRED,
  'common.mainNavigation': REQUIRED,
  'common.languageSwitcher': REQUIRED,
  'common.switchLanguageTo': REQUIRED_TEMPLATE, // SiteHeader: splitLanguageTemplate()
  'common.openMenu': REQUIRED,
  'common.closeMenu': REQUIRED,
  'common.homeLink': REQUIRED,
  'common.backHome': REQUIRED,
  'common.breadcrumbs': REQUIRED,
  'common.mobileMenu': REQUIRED,
  'common.footerNavigation': REQUIRED,
  'common.imageViewer': REQUIRED,
  'common.previousImage': REQUIRED,
  'common.nextImage': REQUIRED,
  'common.closeViewer': REQUIRED,

  // ── forms (lead form states and errors; LeadForm and /api/leads) ──────────
  'forms.sending': REQUIRED,
  'forms.errors.required': REQUIRED,
  'forms.errors.invalidEmail': REQUIRED,
  'forms.errors.invalidPhone': REQUIRED,
  'forms.errors.contactRequired': REQUIRED,
  'forms.errors.tooShort': REQUIRED_TEMPLATE, // LeadForm: fill()
  'forms.errors.tooLong': REQUIRED_TEMPLATE, // LeadForm: fill()
  'forms.errors.rateLimited': REQUIRED,
  'forms.errors.server': REQUIRED,
  'forms.errors.network': REQUIRED,
  'forms.errors.invalidForm': REQUIRED,
  'forms.errors.consentRequired': REQUIRED,
  'forms.errors.invalid': REQUIRED,
  'forms.errors.invalidType': REQUIRED,
  'forms.errors.badRequest': REQUIRED,
  'forms.errors.payloadTooLarge': REQUIRED,
  'forms.errors.unsupportedMediaType': REQUIRED,
  'forms.sendAnother': REQUIRED,
  'forms.noscriptInvalid': REQUIRED,

  // ── social ────────────────────────────────────────────────────────────────
  'social.TELEGRAM': REQUIRED,
  'social.VK': REQUIRED,
  'social.INSTAGRAM': REQUIRED,
  'social.WHATSAPP': REQUIRED,
  'social.YOUTUBE': REQUIRED,
  'social.TIKTOK': REQUIRED,
  'social.PINTEREST': REQUIRED,
  'social.WEBSITE': REQUIRED,
  'social.OTHER': REQUIRED,

  // ── notFound ──────────────────────────────────────────────────────────────
  'notFound.title': REQUIRED,

  // ── error ─────────────────────────────────────────────────────────────────
  'error.title': REQUIRED,
  'error.retry': REQUIRED,

  // ── telegram (owner notifications; read in the default locale only) ──────
  'telegram.newLead': REQUIRED,
  'telegram.leadTypes.TAILORING': REQUIRED,
  'telegram.leadTypes.PARTNERSHIP': REQUIRED,
  'telegram.leadTypes.CONTACT': REQUIRED,
  'telegram.name': REQUIRED,
  'telegram.phone': REQUIRED,
  'telegram.email': REQUIRED,
  'telegram.locale': REQUIRED,
  'telegram.message': REQUIRED,
  'telegram.time': REQUIRED,
  'telegram.openAdmin': REQUIRED,
  'telegram.errors.dryRun': REQUIRED,
  'telegram.errors.notifyCeiling': REQUIRED,
  'telegram.errors.notConfigured': REQUIRED,
  'telegram.errors.badToken': REQUIRED,
  'telegram.errors.timeout': REQUIRED,
  'telegram.errors.network': REQUIRED,
  'telegram.errors.api': REQUIRED,
  'telegram.errors.internal': REQUIRED,
  'telegram.errors.unknown': REQUIRED,
  'telegram.errors.invalidId': REQUIRED,
  'telegram.errors.loadFailed': REQUIRED,
  'telegram.errors.notFound': REQUIRED,
  'telegram.errors.sendFailed': REQUIRED,
};

function metaOf(key: MessageKey): MessageMeta {
  return MESSAGE_META[key] ?? {};
}

/** The admin section of a key ("hero.title" → "hero"). */
export function messageSection(key: MessageKey): SectionId {
  return messageNamespace(key);
}

/** Kind of a key: the override, else "icu" when any default uses ICU syntax, else "text". */
export function messageKind(key: MessageKey): MessageKind {
  const kind = metaOf(key).kind;
  if (kind) return kind;
  const defaults = defaultMessageTranslations(key);
  return Object.values(defaults).some(hasMessageSyntax) ? 'icu' : 'text';
}

/** True for keys that must have text in the default locale (MessageMeta.required). */
export function isRequiredKey(key: MessageKey): boolean {
  return metaOf(key).required === true;
}

/** Everything the admin editor needs about one key. */
export type MessageDefinition = {
  key: MessageKey;
  section: SectionId;
  kind: MessageKind;
  required: boolean;
  /** Position inside its section (messages/ru.json order). */
  order: number;
  /** The messages/<locale>.json value of every locale (what «сбросить» restores). */
  defaults: Record<Locale, string>;
};

const KEYS_BY_SECTION: ReadonlyMap<SectionId, readonly MessageKey[]> = (() => {
  const map = new Map<SectionId, MessageKey[]>();
  for (const key of MESSAGE_KEYS) {
    const section = messageSection(key);
    const keys = map.get(section);
    if (keys) keys.push(key);
    else map.set(section, [key]);
  }
  return map;
})();

/** Keys of a section in messages/ru.json order. */
export function sectionMessageKeys(section: SectionId): readonly MessageKey[] {
  return KEYS_BY_SECTION.get(section) ?? [];
}

export function messageDefinition(key: MessageKey): MessageDefinition {
  const section = messageSection(key);
  return {
    key,
    section,
    kind: messageKind(key),
    required: isRequiredKey(key),
    order: sectionMessageKeys(section).indexOf(key),
    defaults: defaultMessageTranslations(key),
  };
}

/** Definitions of every key of a section, in display order (the admin section editor). */
export function sectionMessageDefinitions(section: SectionId): MessageDefinition[] {
  return sectionMessageKeys(section).map(messageDefinition);
}

// ── images ──────────────────────────────────────────────────────────────────

/**
 * Landing images addressed by key — `ContentImage` rows (key → Media), edited in the admin
 * section they belong to (names: admin.siteTexts.images.<key>). Not messages: the keys never
 * appear in messages/*.json.
 */
export const CONTENT_IMAGES = {
  'about.image': { section: 'about' },
  'tailoring.image': { section: 'tailoring' },
} as const satisfies Readonly<Record<string, { section: SectionId }>>;

/** A ContentImage key ("about.image"). */
export type ImageKey = keyof typeof CONTENT_IMAGES;

function isOwnKey<T extends object>(record: T, key: PropertyKey): key is keyof T {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export function isImageKey(value: string): value is ImageKey {
  return isOwnKey(CONTENT_IMAGES, value);
}

export const IMAGE_KEYS: readonly ImageKey[] = Object.keys(CONTENT_IMAGES).filter(isImageKey);

/** Image keys of a section (the admin shows them with the section's texts). */
export function sectionImageKeys(section: SectionId): readonly ImageKey[] {
  return IMAGE_KEYS.filter(key => CONTENT_IMAGES[key].section === section);
}
