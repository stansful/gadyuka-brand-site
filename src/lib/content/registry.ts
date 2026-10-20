import type { ContentKind } from "../../generated/prisma/enums";

/**
 * Registry of every ContentBlock the landing page uses.
 *
 * - The key is the dotted `section.key` used in `data-edit` / `data-edit-img`
 *   attributes and as ContentBlock.key in the DB.
 * - `label` is the Russian admin label; `section` groups blocks in the admin; `required` blocks
 *   (headings, menu items, buttons) cannot be saved empty in Russian.
 * - kind TEXT      — one line of plain text;
 *   kind RICHTEXT  — plain text with paragraphs separated by an empty line (no HTML);
 *   kind IMAGE     — ContentBlock.mediaId (value is null);
 *   kind LINK      — LocalizedText holding a URL/anchor.
 *
 * Isomorphic (no server-only imports): safe to use in admin client components and in
 * prisma/seed.ts. To add a block: add it here, add its copy in ./default-copy.ts,
 * run `npm run db:seed`, then render it in src/components/site/sections/*.
 *
 * Keys removed from this registry are simply no longer shown in the admin; their old rows stay
 * in the DB untouched (the seed never deletes content).
 */

export const CONTENT_SECTIONS = [
  { id: "header", label: "Шапка и меню" },
  { id: "hero", label: "Главная (обложка)" },
  { id: "catalog", label: "Каталог" },
  { id: "about", label: "О нас" },
  { id: "tailoring", label: "Индивидуальный пошив" },
  { id: "offers", label: "Специальные предложения" },
  { id: "news", label: "Новости и события" },
  { id: "gallery", label: "Галерея" },
  { id: "reviews", label: "Отзывы" },
  { id: "partners", label: "Партнёры" },
  { id: "contacts", label: "Контакты и форма" },
  { id: "footer", label: "Подвал" },
  { id: "common", label: "Общие подписи" },
] as const;

export type SectionId = (typeof CONTENT_SECTIONS)[number]["id"];

/** Section anchors live in ./anchors (tiny, imported by client components); re-exported here. */
export { LEAD_FORM_ANCHOR, SECTION_ANCHORS } from "./anchors";

/**
 * Landing chapters in page order (the owner's): «Глава 01» = catalog, 02 about, [the red band],
 * 03 tailoring, 04 offers, 05 news, 06 gallery, 07 reviews, 08 partners, «Глава 09» = contacts.
 * Chapter numbers, folios («— 02 —») and the red band position are derived from this list,
 * so they always follow the actual order of the sections.
 */
export const CHAPTER_ORDER = [
  "catalog",
  "about",
  "tailoring",
  "offers",
  "news",
  "gallery",
  "reviews",
  "partners",
  "contacts",
] as const satisfies ReadonlyArray<SectionId>;

export type ChapterId = (typeof CHAPTER_ORDER)[number];

/** "02" for about. */
export function chapterNumber(id: ChapterId): string {
  return String(CHAPTER_ORDER.indexOf(id) + 1).padStart(2, "0");
}

type BlockDefinition = {
  readonly section: SectionId;
  readonly kind: ContentKind;
  readonly label: string;
  /**
   * Must not be saved empty in the default locale (ru): headings (h1/h2, the targets of
   * aria-labelledby), menu items and buttons whose only other content is an aria-hidden arrow.
   */
  readonly required?: true;
};

export const CONTENT_BLOCKS = {
  // ── header ───────────────────────────────────────────────────────────────
  "header.nav.home": { section: "header", kind: "TEXT", label: "Меню: Главная", required: true },
  "header.nav.catalog": { section: "header", kind: "TEXT", label: "Меню: Каталог", required: true },
  "header.nav.about": { section: "header", kind: "TEXT", label: "Меню: О нас", required: true },
  "header.nav.tailoring": { section: "header", kind: "TEXT", label: "Меню: Индивидуальный пошив", required: true },
  "header.nav.offers": { section: "header", kind: "TEXT", label: "Меню: Специальное предложение", required: true },
  "header.nav.contacts": { section: "header", kind: "TEXT", label: "Меню: Контакты", required: true },
  "header.menuCaption": { section: "header", kind: "TEXT", label: "Мобильное меню: подпись над пунктами" },
  "header.cta": { section: "header", kind: "TEXT", label: "Мобильное меню: кнопка «Оставить заявку» (ведёт к форме)", required: true },

  // ── hero ─────────────────────────────────────────────────────────────────
  "hero.title": { section: "hero", kind: "TEXT", label: "Заголовок H1 (скрыт, для поисковиков и экранных дикторов)", required: true },
  "hero.subtitle": { section: "hero", kind: "TEXT", label: "Продолжение H1 (скрыто, после тире)" },
  "hero.slogan": { section: "hero", kind: "TEXT", label: "Слоган под вордмарком" },
  "hero.captionTop": { section: "hero", kind: "TEXT", label: "Подпись-плашка слева вверху" },
  "hero.captionBottom": {
    section: "hero",
    kind: "TEXT",
    label: "Плашка справа внизу — кнопка: ведёт на первую опубликованную коллекцию (первую по порядку в разделе «Коллекции»)",
  },
  "hero.issue": { section: "hero", kind: "TEXT", label: "Сезон / выпуск в углу обложки (крупно)" },
  "hero.issueMeta": { section: "hero", kind: "TEXT", label: "Строка под сезоном (город · год)" },
  "hero.sfx": { section: "hero", kind: "TEXT", label: "Звукоподражание на обложке" },
  "hero.hint": { section: "hero", kind: "TEXT", label: "Подсказка внизу обложки (обложка ведёт к «О нас»)" },
  "hero.cursor": { section: "hero", kind: "TEXT", label: "Плашка у курсора над обложкой" },

  // ── catalog ──────────────────────────────────────────────────────────────
  "catalog.title": { section: "catalog", kind: "TEXT", label: "Заголовок главы", required: true },
  "catalog.narration": { section: "catalog", kind: "TEXT", label: "Плашка-подпись под заголовком" },
  "catalog.subtitle": { section: "catalog", kind: "TEXT", label: "Заголовок вступительной панели" },
  "catalog.text": { section: "catalog", kind: "RICHTEXT", label: "Вступительный текст" },
  "catalog.seriesLabel": { section: "catalog", kind: "TEXT", label: "Подпись «Коллекция» над названием" },
  "catalog.openCollection": { section: "catalog", kind: "TEXT", label: "Ссылка на страницу коллекции", required: true },
  "catalog.priceLabel": { section: "catalog", kind: "TEXT", label: "Подпись над ценой на обложке товара" },
  "catalog.priceOnRequest": { section: "catalog", kind: "TEXT", label: "Подпись «Цена по запросу»" },
  "catalog.orderCta": { section: "catalog", kind: "TEXT", label: "Кнопка заказа товара", required: true },
  "catalog.orderSubject": { section: "catalog", kind: "TEXT", label: "Тема письма при заказе (перед названием товара)" },
  "catalog.detailsLabel": { section: "catalog", kind: "TEXT", label: "Подпись «Детали» (страница коллекции)" },
  "catalog.soonTab": { section: "catalog", kind: "TEXT", label: "Вкладка «Новые коллекции — скоро»" },
  "catalog.soonTitle": { section: "catalog", kind: "TEXT", label: "Карточка «скоро»: заголовок" },
  "catalog.soon": { section: "catalog", kind: "TEXT", label: "Карточка «скоро»: текст" },

  // ── about ────────────────────────────────────────────────────────────────
  "about.label": { section: "about", kind: "TEXT", label: "Подпись после номера главы («Глава 02 · …»)" },
  "about.title": { section: "about", kind: "TEXT", label: "Заголовок главы", required: true },
  "about.narration": { section: "about", kind: "TEXT", label: "Плашка-подпись под заголовком" },
  "about.image": { section: "about", kind: "IMAGE", label: "Фото" },
  "about.imageCaption": { section: "about", kind: "TEXT", label: "Плашка на фото" },
  "about.sfx": { section: "about", kind: "TEXT", label: "Звукоподражание на фото" },
  "about.text": { section: "about", kind: "RICHTEXT", label: "Текст" },
  "about.cta": { section: "about", kind: "TEXT", label: "Кнопка «Отзывы покупателей» (ведёт к отзывам)", required: true },
  "about.partnersCta": { section: "about", kind: "TEXT", label: "Кнопка «Партнёры бренда» (ведёт к партнёрам)", required: true },
  "about.advantages.0.title": { section: "about", kind: "TEXT", label: "Преимущество 1: заголовок" },
  "about.advantages.0.text": { section: "about", kind: "TEXT", label: "Преимущество 1: текст" },
  "about.advantages.1.title": { section: "about", kind: "TEXT", label: "Преимущество 2: заголовок" },
  "about.advantages.1.text": { section: "about", kind: "TEXT", label: "Преимущество 2: текст" },
  "about.advantages.2.title": { section: "about", kind: "TEXT", label: "Преимущество 3: заголовок" },
  "about.advantages.2.text": { section: "about", kind: "TEXT", label: "Преимущество 3: текст" },
  "about.closeupCaption": { section: "about", kind: "TEXT", label: "Плашка на «крупном плане» змеи" },

  // ── tailoring ────────────────────────────────────────────────────────────
  "tailoring.title": { section: "tailoring", kind: "TEXT", label: "Заголовок главы", required: true },
  "tailoring.narration": { section: "tailoring", kind: "TEXT", label: "Плашка-подпись под заголовком" },
  "tailoring.image": { section: "tailoring", kind: "IMAGE", label: "Фото «стойка с лекалами»" },
  "tailoring.imageCaption": { section: "tailoring", kind: "TEXT", label: "Плашка на фото" },
  "tailoring.sfx": { section: "tailoring", kind: "TEXT", label: "Звукоподражание на фото" },
  "tailoring.subtitle": { section: "tailoring", kind: "TEXT", label: "Заголовок панели с текстом" },
  "tailoring.text": { section: "tailoring", kind: "RICHTEXT", label: "Вступительный текст" },
  "tailoring.cta": { section: "tailoring", kind: "TEXT", label: "Кнопка «Оставить заявку» (ведёт к форме, тема «Индивидуальный пошив»)", required: true },
  "tailoring.steps.0.title": { section: "tailoring", kind: "TEXT", label: "Пункт 1: заголовок" },
  "tailoring.steps.0.text": { section: "tailoring", kind: "RICHTEXT", label: "Пункт 1: текст" },
  "tailoring.steps.1.title": { section: "tailoring", kind: "TEXT", label: "Пункт 2: заголовок" },
  "tailoring.steps.1.text": { section: "tailoring", kind: "RICHTEXT", label: "Пункт 2: текст" },
  "tailoring.steps.2.title": { section: "tailoring", kind: "TEXT", label: "Пункт 3: заголовок" },
  "tailoring.steps.2.text": { section: "tailoring", kind: "RICHTEXT", label: "Пункт 3: текст" },

  // ── reviews ──────────────────────────────────────────────────────────────
  "reviews.title": { section: "reviews", kind: "TEXT", label: "Заголовок главы", required: true },
  "reviews.narration": { section: "reviews", kind: "TEXT", label: "Плашка-подпись под заголовком" },
  "reviews.text": { section: "reviews", kind: "RICHTEXT", label: "Вступительный текст" },
  "reviews.empty": { section: "reviews", kind: "TEXT", label: "Текст, когда отзывов нет" },

  // ── news ─────────────────────────────────────────────────────────────────
  "news.edition": { section: "news", kind: "TEXT", label: "Шапка газеты: слева" },
  "news.city": { section: "news", kind: "TEXT", label: "Шапка газеты: по центру" },
  "news.kicker": { section: "news", kind: "TEXT", label: "Подпись после номера главы («Глава 05 · …»)" },
  "news.title": { section: "news", kind: "TEXT", label: "Заголовок главы", required: true },
  "news.tickerLabel": { section: "news", kind: "TEXT", label: "Бегущая строка: слово перед заголовками новостей" },
  "news.text": { section: "news", kind: "RICHTEXT", label: "Текст, когда новостей нет" },
  "news.readMore": { section: "news", kind: "TEXT", label: "Ссылка «Подробнее»", required: true },

  // ── gallery ──────────────────────────────────────────────────────────────
  "gallery.title": { section: "gallery", kind: "TEXT", label: "Заголовок главы", required: true },
  "gallery.narration": { section: "gallery", kind: "TEXT", label: "Плашка-подпись под заголовком" },
  "gallery.text": { section: "gallery", kind: "RICHTEXT", label: "Вступительный текст" },
  "gallery.empty": { section: "gallery", kind: "TEXT", label: "Текст, когда в галерее нет фото" },

  // ── offers ───────────────────────────────────────────────────────────────
  "offers.title": { section: "offers", kind: "TEXT", label: "Заголовок главы", required: true },
  "offers.narration": { section: "offers", kind: "TEXT", label: "Плашка-подпись под заголовком" },
  "offers.text": { section: "offers", kind: "RICHTEXT", label: "Вступительный текст" },
  "offers.couponLabel": { section: "offers", kind: "TEXT", label: "Подпись «Купон» на карточке (номер добавляется)" },
  "offers.subject": { section: "offers", kind: "TEXT", label: "Тема письма по купону (перед названием предложения)" },
  "offers.validUntilLabel": { section: "offers", kind: "TEXT", label: "Подпись «Действует до»" },
  "offers.fine": { section: "offers", kind: "TEXT", label: "Сноска под купонами (пусто — не показывать)" },
  "offers.empty": { section: "offers", kind: "TEXT", label: "Текст, когда предложений нет" },

  // ── partners ─────────────────────────────────────────────────────────────
  "partners.title": { section: "partners", kind: "TEXT", label: "Заголовок главы", required: true },
  "partners.narration": { section: "partners", kind: "TEXT", label: "Плашка-подпись под заголовком" },
  "partners.crossoverKicker": { section: "partners", kind: "TEXT", label: "Панель «кроссовер»: надзаголовок" },
  "partners.crossoverLeft": { section: "partners", kind: "TEXT", label: "Панель «кроссовер»: слева от «×»" },
  "partners.crossoverRight": { section: "partners", kind: "TEXT", label: "Панель «кроссовер»: справа от «×»" },
  "partners.text": { section: "partners", kind: "RICHTEXT", label: "Вступительный текст" },
  "partners.cta": { section: "partners", kind: "TEXT", label: "Кнопка «Оставить заявку для сотрудничества» (тема «Сотрудничество»)", required: true },
  "partners.slotPlaceholder": { section: "partners", kind: "TEXT", label: "Пустая ячейка «Место для партнёра»" },

  // ── contacts ─────────────────────────────────────────────────────────────
  "contacts.title": { section: "contacts", kind: "TEXT", label: "Заголовок главы", required: true },
  "contacts.narration": { section: "contacts", kind: "TEXT", label: "Плашка-подпись под заголовком" },
  "contacts.text": { section: "contacts", kind: "RICHTEXT", label: "Вступительный текст" },
  "contacts.phoneLabel": { section: "contacts", kind: "TEXT", label: "Подпись «Телефон»" },
  "contacts.emailLabel": { section: "contacts", kind: "TEXT", label: "Подпись «E-mail»" },
  "contacts.addressLabel": { section: "contacts", kind: "TEXT", label: "Подпись «Адрес»" },
  "contacts.socialsLabel": { section: "contacts", kind: "TEXT", label: "Подпись «Соцсети»" },
  "contacts.form.to": { section: "contacts", kind: "TEXT", label: "Форма: строка «Кому» над заголовком" },
  "contacts.form.title": { section: "contacts", kind: "TEXT", label: "Форма: заголовок", required: true },
  "contacts.form.subjectLabel": { section: "contacts", kind: "TEXT", label: "Форма: подпись темы, выбранной кнопкой на сайте" },
  "contacts.form.topicLabel": { section: "contacts", kind: "TEXT", label: "Форма: поле «Тема»" },
  "contacts.form.topics.contact": { section: "contacts", kind: "TEXT", label: "Тема: вопрос / другое (заявка «Связаться»)" },
  "contacts.form.topics.tailoring": { section: "contacts", kind: "TEXT", label: "Тема: индивидуальный пошив" },
  "contacts.form.topics.partnership": { section: "contacts", kind: "TEXT", label: "Тема: сотрудничество" },
  "contacts.form.emailLabel": { section: "contacts", kind: "TEXT", label: "Форма: поле «E-mail»" },
  "contacts.form.emailPlaceholder": { section: "contacts", kind: "TEXT", label: "Форма: подсказка в поле «E-mail»" },
  "contacts.form.nameLabel": { section: "contacts", kind: "TEXT", label: "Форма: поле «Имя»" },
  "contacts.form.namePlaceholder": { section: "contacts", kind: "TEXT", label: "Форма: подсказка в поле «Имя»" },
  "contacts.form.phoneLabel": { section: "contacts", kind: "TEXT", label: "Форма: поле «Телефон» (темы «пошив» и «сотрудничество»)" },
  "contacts.form.phonePlaceholder": { section: "contacts", kind: "TEXT", label: "Форма: подсказка в поле «Телефон»" },
  "contacts.form.commentLabel": { section: "contacts", kind: "TEXT", label: "Форма: поле «Комментарий»" },
  "contacts.form.commentPlaceholder": { section: "contacts", kind: "TEXT", label: "Форма: подсказка в поле «Комментарий»" },
  "contacts.form.consent": { section: "contacts", kind: "TEXT", label: "Форма: согласие на обработку персональных данных" },
  "contacts.form.submit": { section: "contacts", kind: "TEXT", label: "Форма: кнопка «Связаться»" },
  "contacts.form.success": { section: "contacts", kind: "TEXT", label: "Форма: сообщение об успехе" },

  // ── footer ───────────────────────────────────────────────────────────────
  "footer.end": { section: "footer", kind: "TEXT", label: "Плашка над «Продолжение следует…»" },
  "footer.tbc": { section: "footer", kind: "TEXT", label: "«Продолжение следует…»" },
  "footer.copyright": { section: "footer", kind: "TEXT", label: "Копирайт (год добавляется автоматически)" },
  "footer.trademark": { section: "footer", kind: "TEXT", label: "Строка о товарном знаке под подвалом (пусто в обоих языках — не показывать; пустой EN покажет русский текст)" },
  "footer.top": { section: "footer", kind: "TEXT", label: "Ссылка «Наверх»", required: true },

  // ── common ───────────────────────────────────────────────────────────────
  "common.chapter": { section: "common", kind: "TEXT", label: "Слово «Глава» перед номером главы (номер добавляется)" },
} as const satisfies Record<string, BlockDefinition>;

type Blocks = typeof CONTENT_BLOCKS;

/** Every ContentBlock key. */
export type ContentKey = keyof Blocks;
/** Keys whose value is LocalizedText (TEXT / RICHTEXT / LINK). */
export type TextKey = { [K in ContentKey]: Blocks[K]["kind"] extends "IMAGE" ? never : K }[ContentKey];
/** Keys whose value is a Media reference (IMAGE). */
export type ImageKey = { [K in ContentKey]: Blocks[K]["kind"] extends "IMAGE" ? K : never }[ContentKey];

export function isContentKey(value: string): value is ContentKey {
  return Object.prototype.hasOwnProperty.call(CONTENT_BLOCKS, value);
}

export function isImageKey(value: string): value is ImageKey {
  return isContentKey(value) && CONTENT_BLOCKS[value].kind === "IMAGE";
}

export function isTextKey(value: string): value is TextKey {
  return isContentKey(value) && CONTENT_BLOCKS[value].kind !== "IMAGE";
}

/** True for blocks that must have text in the default locale (BlockDefinition.required). */
export function isRequiredKey(key: ContentKey): boolean {
  const definition: BlockDefinition = CONTENT_BLOCKS[key];
  return definition.required === true;
}

/** All keys in declaration order (= display order inside each section). */
export const CONTENT_KEYS: readonly ContentKey[] = Object.keys(CONTENT_BLOCKS).filter(isContentKey);
export const TEXT_KEYS: readonly TextKey[] = CONTENT_KEYS.filter(isTextKey);
export const IMAGE_KEYS: readonly ImageKey[] = CONTENT_KEYS.filter(isImageKey);

/** Order of a key inside its section (used as ContentBlock.order). */
export function contentKeyOrder(key: ContentKey): number {
  const section = CONTENT_BLOCKS[key].section;
  return CONTENT_KEYS.filter((k) => CONTENT_BLOCKS[k].section === section).indexOf(key);
}
