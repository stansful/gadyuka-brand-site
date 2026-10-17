import type { Locale } from "@/i18n/locales";
import type { TextKey } from "./registry";

/** The copy of one text block in every language. */
export type Copy = Record<Locale, string>;

/**
 * Default copy of every text ContentBlock — the seed writes it to the DB, and the read layer
 * (getLanding) uses it for registry keys that have no DB row yet (a release deployed before
 * `npm run db:seed` added the new keys). RU = BRIEF.md (typos fixed) + the copy of the chosen
 * design «Нуар-комикс» (concepts/01-noir-comic), EN = brand English.
 * `Record<TextKey, Copy>` makes TypeScript fail if a registry key has no copy.
 *
 * RULE: the collection «Меня запомнят» is never described as first / debut / №1 — the hero
 * corner shows a season label («Осень ’26»), not an issue number.
 */
export const CONTENT_COPY: Record<TextKey, Copy> = {
  // ── header ───────────────────────────────────────────────────────────────
  "header.nav.home": { ru: "Главная", en: "Home" },
  "header.nav.catalog": { ru: "Каталог", en: "Catalog" },
  "header.nav.about": { ru: "О нас", en: "About" },
  "header.nav.tailoring": { ru: "Индивидуальный пошив", en: "Made to Measure" },
  "header.nav.contacts": { ru: "Контакты", en: "Contact" },
  "header.menuCaption": { ru: "Содержание выпуска", en: "In this issue" },
  "header.cta": { ru: "Оставить заявку", en: "Send a request" },

  // ── hero ─────────────────────────────────────────────────────────────────
  "hero.title": { ru: "ГАДЮКА", en: "GADYUKA" },
  "hero.subtitle": {
    ru: "Авторская уличная одежда из Краснодара",
    en: "Designer streetwear from Krasnodar",
  },
  "hero.slogan": { ru: "Меня запомнят", en: "They will remember me" },
  "hero.captionTop": { ru: "Краснодар. Ночь.", en: "Krasnodar. Night." },
  "hero.captionBottom": { ru: "Коллекция «Меня запомнят»", en: "The «They Will Remember Me» collection" },
  "hero.issue": { ru: "Осень ’26", en: "Fall ’26" },
  "hero.issueMeta": { ru: "Краснодар · 2026", en: "Krasnodar · 2026" },
  "hero.sfx": { ru: "ШШШ…", en: "HSSSS…" },
  "hero.hint": {
    ru: "Нажмите на обложку — перейти к главе «О нас»",
    en: "Tap the cover to turn to the «About» chapter",
  },
  "hero.cursor": { ru: "О нас →", en: "About →" },

  // ── catalog ──────────────────────────────────────────────────────────────
  "catalog.title": { ru: "Каталог одежды", en: "The Catalog" },
  "catalog.narration": { ru: "В этом выпуске…", en: "In this issue…" },
  "catalog.subtitle": { ru: "Одежда с характером", en: "Clothes with character" },
  "catalog.text": {
    ru: "Бренд Гадюка предлагает стильную и комфортную одежду с авторской разработкой моделей. Наша философия — это сочетание удобства и красоты, без банальных дизайнов. Мы создаём одежду, подчёркивающую уникальность каждого человека, для ритма большого города.",
    en: "GADYUKA makes stylish, comfortable clothing built on original, in-house design. Our philosophy is comfort and beauty in one — never a cliché. We create clothes that bring out what makes each person unique, cut for the rhythm of the big city.",
  },
  "catalog.seriesLabel": { ru: "Коллекция", en: "Collection" },
  "catalog.openCollection": { ru: "Открыть коллекцию", en: "View the collection" },
  "catalog.priceLabel": { ru: "цена", en: "price" },
  "catalog.priceOnRequest": { ru: "Цена по запросу", en: "Price on request" },
  "catalog.orderCta": { ru: "Заказать", en: "Order" },
  "catalog.orderSubject": { ru: "Заказ:", en: "Order:" },
  "catalog.detailsLabel": { ru: "Детали", en: "Details" },
  "catalog.soonTab": { ru: "Новые коллекции — скоро", en: "New collections — soon" },
  "catalog.soonTitle": { ru: "Следующая коллекция готовится", en: "The next collection is in the works" },
  "catalog.soon": {
    ru: "Новые коллекции появятся здесь — следите за обновлениями.",
    en: "New collections will appear here — stay tuned.",
  },

  // ── about ────────────────────────────────────────────────────────────────
  "about.label": { ru: "О нас", en: "About" },
  "about.title": { ru: "Преимущества бренда Гадюка", en: "Why GADYUKA" },
  "about.narration": { ru: "История происхождения.", en: "An origin story." },
  "about.imageCaption": {
    ru: "Он не оборачивается. Его и так узнают.",
    en: "He never turns around. They know him anyway.",
  },
  "about.sfx": { ru: "ТССС!", en: "SHHH!" },
  "about.text": {
    ru: "Наш бренд предлагает стильную и комфортную одежду с авторской разработкой моделей. Мы уделяем особое внимание качеству и деталям, чтобы вы чувствовали себя уверенно и стильно. Выбирая Гадюку, вы выбираете качество и индивидуальность.",
    en: "Our brand offers stylish, comfortable clothing with original, in-house design. We pay close attention to quality and detail so you feel confident and look sharp. Choosing GADYUKA means choosing quality and individuality.",
  },
  "about.cta": { ru: "Отзывы покупателей", en: "Customer reviews" },
  "about.advantages.0.title": { ru: "Авторские модели", en: "Original designs" },
  "about.advantages.0.text": {
    ru: "Каждую модель мы разрабатываем сами — без банальных дизайнов.",
    en: "Every piece is designed in-house — no clichés.",
  },
  "about.advantages.1.title": { ru: "Качество и детали", en: "Quality and detail" },
  "about.advantages.1.text": {
    ru: "Особое внимание к материалам, посадке и каждой мелочи.",
    en: "Close attention to fabric, fit and every small detail.",
  },
  "about.advantages.2.title": { ru: "Индивидуальность", en: "Individuality" },
  "about.advantages.2.text": {
    ru: "Одежда, которая подчёркивает характер и живёт в ритме большого города.",
    en: "Clothes that bring out your character and keep pace with the big city.",
  },
  "about.closeupCaption": {
    ru: "Крупный план. Выбирая Гадюку, вы выбираете качество и индивидуальность.",
    en: "Close-up. Choose GADYUKA — choose quality and individuality.",
  },

  // ── tailoring ────────────────────────────────────────────────────────────
  "tailoring.title": { ru: "Индивидуальный пошив", en: "Made to Measure" },
  "tailoring.narration": { ru: "Тем временем в мастерской…", en: "Meanwhile, in the workshop…" },
  "tailoring.imageCaption": {
    ru: "Лекала — основа каждой модели",
    en: "Patterns — the foundation of every piece",
  },
  "tailoring.sfx": { ru: "ЧИК!", en: "SNIP!" },
  "tailoring.subtitle": { ru: "Сшито по вашим меркам", en: "Sewn to your measurements" },
  "tailoring.text": {
    ru: "У нас вы можете заказать индивидуальный пошив одежды. Мы создаём уникальные модели, которые идеально подойдут вам. Расскажите нам о своих предпочтениях, и мы воплотим их в жизнь.",
    en: "Order a piece made just for you. We create one-of-a-kind garments that fit you perfectly. Tell us what you have in mind — and we'll bring it to life.",
  },
  "tailoring.cta": { ru: "Оставить заявку", en: "Submit a request" },
  "tailoring.steps.0.title": { ru: "Пошив по меркам", en: "Cut to your measurements" },
  "tailoring.steps.0.text": {
    ru: "Пошив одежды по индивидуальным меркам и пожеланиям клиента. Возможность создать уникальный образ, соответствующий вашему стилю.",
    en: "Clothing tailored to your individual measurements and wishes — a chance to create a unique look that matches your style.",
  },
  "tailoring.steps.1.title": { ru: "Преимущества индивидуального пошива", en: "Why made to measure" },
  "tailoring.steps.1.text": {
    ru: "Идеальная посадка, возможность выбора ткани и дизайна, уникальность образа.",
    en: "A perfect fit, your choice of fabric and design, and a look no one else has.",
  },
  "tailoring.steps.2.title": { ru: "Как заказать", en: "How to order" },
  "tailoring.steps.2.text": {
    ru: "Опишите свои пожелания, выберите модель и ткань. Наши специалисты помогут вам создать индивидуальный образ.",
    en: "Describe what you have in mind, then choose a model and fabric. Our team will help you create a look that is entirely yours.",
  },

  // ── reviews ──────────────────────────────────────────────────────────────
  "reviews.title": { ru: "Отзывы покупателей", en: "Customer reviews" },
  "reviews.narration": { ru: "Говорят очевидцы.", en: "The witnesses speak." },
  "reviews.text": {
    ru: "Авторские модели бренда Гадюка сочетают стильный дизайн с удобством для жизни в ритме большого города.",
    en: "GADYUKA's original designs pair a sharp look with the comfort that big-city life demands.",
  },
  "reviews.empty": {
    ru: "Очевидцы пока молчат. Носите ГАДЮКУ? Расскажите нам — напишите в редакцию.",
    en: "The witnesses are keeping quiet — for now. Wearing GADYUKA? Tell us — write to the editor.",
  },

  // ── news ─────────────────────────────────────────────────────────────────
  "news.edition": { ru: "Экстренный выпуск", en: "Extra edition" },
  "news.city": { ru: "Краснодар", en: "Krasnodar" },
  "news.kicker": { ru: "Вестник «Гадюки»", en: "The GADYUKA Gazette" },
  "news.title": { ru: "Новости и события", en: "News & Events" },
  "news.tickerLabel": { ru: "Срочно:", en: "Breaking:" },
  "news.text": {
    ru: "Новые модели, поп-апы и события бренда — следите за новостями ГАДЮКИ.",
    en: "New pieces, pop-ups and brand events — keep up with GADYUKA.",
  },
  "news.readMore": { ru: "Подробнее", en: "Read more" },

  // ── gallery ──────────────────────────────────────────────────────────────
  "gallery.title": { ru: "Галерея изображений", en: "Gallery" },
  "gallery.narration": { ru: "Материалы дела.", en: "The case files." },
  "gallery.text": {
    ru: "Посмотрите разнообразие моделей и стилей в нашей галерее изображений. Мы покажем вам, как наша одежда может подчеркнуть вашу индивидуальность и стиль.",
    en: "Explore the range of designs and styles in our gallery — and see how our clothes can bring out your individuality and style.",
  },
  "gallery.empty": {
    ru: "Материалы дела ещё собираются — загляните позже.",
    en: "The case files are still coming in — check back soon.",
  },

  // ── offers ───────────────────────────────────────────────────────────────
  "offers.title": { ru: "Специальные предложения", en: "Special Offers" },
  "offers.narration": { ru: "Только в этом выпуске!", en: "This issue only!" },
  "offers.text": {
    ru: "Узнайте о специальных предложениях и акциях, которые помогут вам сэкономить на покупках одежды бренда Гадюка.",
    en: "Discover special offers and promotions that help you save on GADYUKA clothing.",
  },
  "offers.couponLabel": { ru: "Купон", en: "Coupon" },
  "offers.subject": { ru: "Купон:", en: "Coupon:" },
  "offers.validUntilLabel": { ru: "Действует до", en: "Valid until" },
  "offers.fine": {
    ru: "* Подробные условия акций уточняйте у менеджера.",
    en: "* Ask our team for the full terms of each offer.",
  },
  "offers.empty": {
    ru: "Новых предложений пока нет — следите за выпусками.",
    en: "No offers right now — watch for the next issue.",
  },

  // ── partners ─────────────────────────────────────────────────────────────
  "partners.title": { ru: "Партнёры бренда Гадюка", en: "GADYUKA Partners" },
  "partners.narration": { ru: "Кроссовер.", en: "Crossover." },
  "partners.crossoverKicker": { ru: "Специальный выпуск", en: "Special issue" },
  "partners.crossoverLeft": { ru: "Гадюка", en: "Gadyuka" },
  "partners.crossoverRight": { ru: "ваш бренд", en: "your brand" },
  "partners.text": {
    ru: "Мы сотрудничаем с другими брендами и организациями, чтобы предложить вам лучшие товары и услуги. Узнайте больше о нашем сотрудничестве и о том, как мы работаем вместе для создания стильной и комфортной одежды.",
    en: "We collaborate with other brands and organisations to bring you the best products and services. Learn more about our partnerships and how we work together to create stylish, comfortable clothing.",
  },
  "partners.cta": { ru: "Оставить заявку для сотрудничества", en: "Apply for a partnership" },
  "partners.slotPlaceholder": { ru: "Место для партнёра", en: "Your brand here" },

  // ── contacts ─────────────────────────────────────────────────────────────
  "contacts.title": { ru: "Контакты", en: "Contact" },
  "contacts.narration": { ru: "Письмо в редакцию.", en: "A letter to the editor." },
  "contacts.text": {
    ru: "Свяжитесь с нами по телефону или электронной почте для получения дополнительной информации.",
    en: "Reach us by phone or email for more information.",
  },
  "contacts.phoneLabel": { ru: "Телефон", en: "Phone" },
  "contacts.emailLabel": { ru: "E-mail", en: "Email" },
  "contacts.addressLabel": { ru: "Адрес", en: "Address" },
  "contacts.socialsLabel": { ru: "Соцсети", en: "Social media" },
  "contacts.form.to": {
    ru: "Кому: редакции «Гадюки», Краснодар",
    en: "To: the GADYUKA editorial desk, Krasnodar",
  },
  "contacts.form.title": { ru: "Напишите нам", en: "Write to us" },
  "contacts.form.subjectLabel": { ru: "По поводу:", en: "Regarding:" },
  "contacts.form.topicLabel": { ru: "Тема", en: "Topic" },
  "contacts.form.topics.contact": { ru: "Вопрос или другое", en: "A question or something else" },
  "contacts.form.topics.tailoring": { ru: "Индивидуальный пошив", en: "Made to measure" },
  "contacts.form.topics.partnership": { ru: "Сотрудничество", en: "Partnership" },
  "contacts.form.emailLabel": { ru: "E-mail", en: "Email" },
  "contacts.form.emailPlaceholder": { ru: "you@mail.ru", en: "you@mail.com" },
  "contacts.form.nameLabel": { ru: "Имя", en: "Name" },
  "contacts.form.namePlaceholder": { ru: "Как к вам обращаться", en: "What should we call you?" },
  "contacts.form.phoneLabel": { ru: "Телефон", en: "Phone" },
  "contacts.form.phonePlaceholder": { ru: "+7 900 000-00-00", en: "+7 900 000-00-00" },
  "contacts.form.commentLabel": { ru: "Комментарий", en: "Comment" },
  "contacts.form.commentPlaceholder": {
    ru: "Расскажите, что хотите заказать",
    en: "Tell us what you have in mind",
  },
  "contacts.form.consent": {
    ru: "Я согласен(-на) на обработку моих персональных данных для ответа на письмо",
    en: "I agree to the processing of my personal data so you can reply to my letter",
  },
  "contacts.form.submit": { ru: "Связаться", en: "Get in touch" },
  "contacts.form.success": {
    ru: "Спасибо! Мы свяжемся с вами в ближайшее время.",
    en: "Thank you! We'll be in touch soon.",
  },

  // ── footer ───────────────────────────────────────────────────────────────
  "footer.end": { ru: "Конец выпуска.", en: "End of issue." },
  "footer.tbc": { ru: "Продолжение следует…", en: "To be continued…" },
  "footer.copyright": { ru: "© ГАДЮКА", en: "© GADYUKA" },
  "footer.top": { ru: "Наверх", en: "Back to top" },

  // ── common ───────────────────────────────────────────────────────────────
  "common.chapter": { ru: "Глава", en: "Chapter" },
};
