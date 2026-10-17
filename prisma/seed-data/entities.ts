import type { SeedMediaKey } from "./media";

type Copy = { ru: string; en: string };

/**
 * Seed entities. Rows without a natural unique key get deterministic ids
 * ("seed-…") so re-running the seed upserts instead of duplicating.
 *
 * RULE: the collection «Меня запомнят» is never described as first / debut / №1.
 * Reviews, news, offers and partners are PLACEHOLDERS to be replaced in the admin.
 */

export const SEED_COLLECTION = {
  slug: "menya-zapomnyat",
  title: { ru: "Меня запомнят", en: "They Will Remember Me" },
  description: {
    ru: "Худи с тату-графикой ГАДЮКИ: змея, обвивающая «Г», голова змеи анфас, чешуя и большая голова на спине. Слоган «Меня запомнят» — на каждой вещи.",
    en: "Hoodies carrying GADYUKA's tattoo graphics: the snake coiled around the «Г», a face-on snake head, scales, and an oversized head across the back. The slogan «They Will Remember Me» is on every piece.",
  },
  cover: "hoodieBlackBack",
  order: 0,
} as const satisfies {
  slug: string;
  title: Copy;
  description: Copy;
  cover: SeedMediaKey;
  order: number;
};

type SeedProduct = {
  slug: string;
  title: Copy;
  description: Copy;
  details: Copy;
  images: readonly SeedMediaKey[];
};

export const SEED_PRODUCTS: readonly SeedProduct[] = [
  {
    slug: "hoodie-white-logo",
    title: { ru: "Худи «Знак», белое", en: "Sign Hoodie — White" },
    description: {
      ru: "Белое худи с главным знаком бренда: гравюрная змея с раскрытой пастью обвивает букву «Г». Внизу — надпись «ГАДЮКА / Меня запомнят».",
      en: "A white hoodie bearing the brand's signature mark: an engraved snake, jaws open, coiled around the letter «Г». Finished with «ГАДЮКА / They Will Remember Me» at the hem.",
    },
    details: {
      ru: "Принт: логотип — змея и буква «Г»\nНадпись «ГАДЮКА / Меня запомнят» внизу\nФирменная бирка с красным языком\nСостав и размеры — уточняйте при заказе",
      en: "Print: the logo — snake and letter «Г»\n«ГАДЮКА / They Will Remember Me» lettering at the hem\nSignature hang tag with the red tongue\nAsk about fabric and sizes when ordering",
    },
    images: ["hoodieWhiteLogo"],
  },
  {
    slug: "hoodie-white-head",
    title: { ru: "Худи «Анфас», белое", en: "Face-On Hoodie — White" },
    description: {
      ru: "Белое худи с головой змеи анфас: раскрытая пасть, клыки и тонкая тату-графика. Взгляд, который не забудут.",
      en: "A white hoodie with the snake's head face-on: open jaws, fangs and fine tattoo linework. A stare no one forgets.",
    },
    details: {
      ru: "Принт: голова змеи анфас\nНадпись «ГАДЮКА / Меня запомнят» внизу\nФирменная бирка с красным языком\nСостав и размеры — уточняйте при заказе",
      en: "Print: face-on snake head\n«ГАДЮКА / They Will Remember Me» lettering at the hem\nSignature hang tag with the red tongue\nAsk about fabric and sizes when ordering",
    },
    images: ["hoodieWhiteHead"],
  },
  {
    slug: "hoodie-white-scales",
    title: { ru: "Худи «Чешуя», белое", en: "Scales Hoodie — White" },
    description: {
      ru: "Белое худи с паттерном змеиной чешуи — фирменный элемент ГАДЮКИ в графике гравюры.",
      en: "A white hoodie with a snake-scale pattern — GADYUKA's signature element, drawn in an engraving style.",
    },
    details: {
      ru: "Принт: змеиная чешуя\nНадпись «ГАДЮКА / Меня запомнят» внизу\nФирменная бирка с красным языком\nСостав и размеры — уточняйте при заказе",
      en: "Print: snake scales\n«ГАДЮКА / They Will Remember Me» lettering at the hem\nSignature hang tag with the red tongue\nAsk about fabric and sizes when ordering",
    },
    images: ["hoodieWhiteScales"],
  },
  {
    slug: "hoodie-black-back",
    title: { ru: "Худи «Голова», чёрное", en: "Head Hoodie — Black" },
    description: {
      ru: "Чёрное худи с крупной головой змеи во всю спину. Главная вещь для тех, кого запомнят.",
      en: "A black hoodie with an oversized snake head across the entire back. The statement piece for those who will be remembered.",
    },
    details: {
      ru: "Принт: большая голова змеи на спине\nЦвет: чёрный\nФирменная бирка с красным языком\nСостав и размеры — уточняйте при заказе",
      en: "Print: oversized snake head on the back\nColour: black\nSignature hang tag with the red tongue\nAsk about fabric and sizes when ordering",
    },
    images: ["hoodieBlackBack"],
  },
];

type SeedReview = { id: string; author: string; role: Copy; text: Copy; rating: number };

export const SEED_REVIEWS: readonly SeedReview[] = [
  {
    id: "seed-review-1",
    author: "Сергей",
    role: { ru: "покупатель", en: "customer" },
    text: {
      ru: "Бренд Гадюка предлагает уникальные модели, которые идеально подходят для жизни в большом городе. Доволен своей покупкой!",
      en: "GADYUKA offers unique designs that are perfect for big-city life. Very happy with my purchase!",
    },
    rating: 5,
  },
  {
    id: "seed-review-2",
    author: "Анна",
    role: { ru: "покупательница", en: "customer" },
    text: {
      ru: "Худи отлично сидит, а принт со змеёй замечают везде, где бы я ни была.",
      en: "The hoodie fits beautifully, and the snake print gets noticed wherever I go.",
    },
    rating: 5,
  },
  {
    id: "seed-review-3",
    author: "Дмитрий",
    role: { ru: "индивидуальный пошив", en: "made-to-measure client" },
    text: {
      ru: "Заказывал худи по своим меркам — помогли с тканью и посадкой. Результат превзошёл ожидания.",
      en: "I ordered a hoodie to my own measurements — the team helped with fabric and fit. The result exceeded my expectations.",
    },
    rating: 5,
  },
];

type SeedNews = {
  slug: string;
  title: Copy;
  excerpt: Copy;
  body: Copy;
  date: string;
  image: SeedMediaKey;
};

export const SEED_NEWS: readonly SeedNews[] = [
  {
    slug: "kollekciya-menya-zapomnyat-v-kataloge",
    title: {
      ru: "Коллекция «Меня запомнят» — в каталоге",
      en: "«They Will Remember Me» is now in the catalog",
    },
    excerpt: {
      ru: "Четыре худи с фирменной тату-графикой: знак, голова змеи анфас, чешуя и большая голова на спине.",
      en: "Four hoodies with signature tattoo graphics: the mark, a face-on snake head, scales and an oversized head on the back.",
    },
    body: {
      ru: "Коллекция «Меня запомнят» уже в каталоге. Четыре худи с гравюрной графикой ГАДЮКИ — от главного знака до большой головы змеи во всю спину.\n\nКаждая вещь приходит в фирменной коробке с номером и биркой с красным языком.",
      en: "«They Will Remember Me» is now in the catalog. Four hoodies with GADYUKA's engraving-style graphics — from the signature mark to an oversized snake head across the back.\n\nEvery piece arrives in a numbered signature box with the red-tongue hang tag.",
    },
    date: "2026-10-01T09:00:00.000Z",
    image: "hoodieWhiteLogo",
  },
  {
    slug: "pop-up-v-krasnodare",
    title: { ru: "Поп-ап ГАДЮКИ в Краснодаре", en: "GADYUKA pop-up in Krasnodar" },
    excerpt: {
      ru: "Примерьте худи вживую, познакомьтесь с командой и обсудите индивидуальный пошив. Дата и место — скоро.",
      en: "Try the hoodies on, meet the team and talk made-to-measure. Date and venue coming soon.",
    },
    body: {
      ru: "Готовим поп-ап в Краснодаре: можно будет примерить модели коллекции «Меня запомнят», познакомиться с командой и обсудить индивидуальный пошив.\n\nДату и место объявим в новостях и соцсетях.",
      en: "We're preparing a pop-up in Krasnodar: try on pieces from «They Will Remember Me», meet the team and talk through a made-to-measure order.\n\nDate and venue will be announced in our news and on social media.",
    },
    date: "2026-10-10T09:00:00.000Z",
    image: "packaging",
  },
];

type SeedGalleryItem = { id: string; media: SeedMediaKey; caption: Copy };

export const SEED_GALLERY: readonly SeedGalleryItem[] = [
  {
    id: "seed-gallery-1",
    media: "snakeHeadCloseup",
    caption: { ru: "Голова гадюки — гравюрная графика бренда", en: "The viper's head — the brand's engraving-style artwork" },
  },
  {
    id: "seed-gallery-2",
    media: "labelLogo",
    caption: { ru: "Тканевая нашивка с логотипом", en: "Woven logo label" },
  },
  {
    id: "seed-gallery-3",
    media: "hangtag",
    caption: { ru: "Фирменная бирка с красным языком", en: "Signature hang tag with the red tongue" },
  },
  {
    id: "seed-gallery-4",
    media: "wordmarkPatternRed",
    caption: { ru: "Вордмарк ГАДЮКА на красном", en: "GADYUKA wordmark on red" },
  },
  {
    id: "seed-gallery-5",
    media: "labelTongue",
    caption: { ru: "Нашивка с раздвоенным языком", en: "Forked-tongue label" },
  },
  {
    id: "seed-gallery-6",
    media: "styleElements",
    caption: { ru: "Фирменные элементы стиля", en: "Signature style elements" },
  },
];

type SeedOffer = {
  id: string;
  title: Copy;
  text: Copy;
  badge: Copy;
  ctaLabel: Copy;
  ctaHref: string;
  validUntil: string | null;
  image: SeedMediaKey | null;
};

export const SEED_OFFERS: readonly SeedOffer[] = [
  {
    id: "seed-offer-1",
    title: { ru: "−10% на индивидуальный пошив", en: "10% off made-to-measure" },
    text: {
      ru: "Оставьте заявку на индивидуальный пошив до конца года и получите скидку 10%. Условия уточняйте у менеджера.",
      en: "Request a made-to-measure piece before the end of the year and get 10% off. Ask our team for details.",
    },
    badge: { ru: "−10%", en: "−10%" },
    ctaLabel: { ru: "Оставить заявку", en: "Submit a request" },
    ctaHref: "#tailoring",
    validUntil: "2026-12-31T20:59:59.000Z",
    image: "lekalaRack",
  },
  {
    id: "seed-offer-2",
    title: { ru: "Подарочная упаковка", en: "Gift packaging" },
    text: {
      ru: "Каждое худи — в фирменной коробке с номером. Упакуем покупку в подарок без доплаты.",
      en: "Every hoodie comes in a numbered signature box. We'll gift-wrap your purchase at no extra cost.",
    },
    badge: { ru: "Подарок", en: "Gift" },
    ctaLabel: { ru: "Связаться", en: "Get in touch" },
    ctaHref: "#contacts",
    validUntil: null,
    image: "packaging",
  },
];

/**
 * Partner rows are DRAFTS (published: false): Partner.name is one string for every language
 * (a brand name), so a placeholder like «Партнёр 01» would show Russian on the English site.
 * Until real partners are added, the site shows its own localized free slots («Место для
 * партнёра» / «Your brand here»); the drafts are templates in the admin — fill in the real
 * name and logo, then switch on «Показывать на сайте».
 */
type SeedPartner = { id: string; name: string; description: Copy; published: false };

export const SEED_PARTNERS: readonly SeedPartner[] = [
  {
    id: "seed-partner-1",
    name: "Партнёр 01",
    published: false,
    description: {
      ru: "Тату-студия — место для логотипа партнёра (заглушка)",
      en: "Tattoo studio — partner logo goes here (placeholder)",
    },
  },
  {
    id: "seed-partner-2",
    name: "Партнёр 02",
    published: false,
    description: {
      ru: "Печать и вышивка — место для партнёра (заглушка)",
      en: "Print & embroidery — partner slot (placeholder)",
    },
  },
  {
    id: "seed-partner-3",
    name: "Партнёр 03",
    published: false,
    description: {
      ru: "Концепт-стор — место для партнёра (заглушка)",
      en: "Concept store — partner slot (placeholder)",
    },
  },
];

export const SEED_SETTINGS = {
  /** PLACEHOLDER — replace in the admin («Настройки»). */
  phone: "+7 (000) 000-00-00",
  /** PLACEHOLDER — example.com is a reserved demo domain. */
  email: "hello@example.com",
  address: {
    ru: "Краснодар (адрес — заглушка, укажите в админке)",
    en: "Krasnodar, Russia (placeholder address — set it in the admin)",
  },
  socials: [{ type: "telegram", url: "https://t.me/" }],
  seoTitle: {
    ru: "ГАДЮКА — авторская уличная одежда из Краснодара",
    en: "GADYUKA — designer streetwear from Krasnodar",
  },
  seoDescription: {
    ru: "Стритвир с авторскими моделями и тату-графикой: худи коллекции «Меня запомнят» и индивидуальный пошив. Краснодар.",
    en: "Streetwear with original designs and tattoo graphics: hoodies from the «They Will Remember Me» collection and made-to-measure tailoring. Krasnodar.",
  },
  ogImage: "wordmarkOnBlack",
} as const satisfies {
  phone: string;
  email: string;
  address: Copy;
  socials: ReadonlyArray<{ type: string; url: string }>;
  seoTitle: Copy;
  seoDescription: Copy;
  ogImage: SeedMediaKey;
};
