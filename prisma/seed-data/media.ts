type SeedMedia = {
  /** Source file, relative to the project root (assets/ is read-only). */
  source: string;
  /** Output file name inside UPLOAD_DIR/seed/ (always .webp). */
  output: string;
  alt: { ru: string; en: string };
};

/**
 * Seed media: brand photos + key brandbook slides, converted with sharp to WebP
 * (max 2400 px on the long side) into UPLOAD_DIR/seed/. Media.path =
 * "seed/<output without .webp>-<8-char content hash>.webp" (older databases may still have
 * "seed/<output>"): a changed source gets a new URL, files are never rewritten in place.
 */
export const SEED_MEDIA = {
  hoodieWhiteLogo: {
    source: "assets/photos/hoodie-white-logo.jpg",
    output: "hoodie-white-logo.webp",
    alt: {
      ru: "Белое худи с логотипом ГАДЮКА — змея обвивает букву «Г»",
      en: "White hoodie with the GADYUKA logo — a snake coiled around the letter «Г»",
    },
  },
  hoodieWhiteHead: {
    source: "assets/photos/hoodie-white-head.jpg",
    output: "hoodie-white-head.webp",
    alt: {
      ru: "Белое худи с принтом головы змеи анфас",
      en: "White hoodie with a face-on snake head print",
    },
  },
  hoodieWhiteScales: {
    source: "assets/photos/hoodie-white-scales.jpg",
    output: "hoodie-white-scales.webp",
    alt: {
      ru: "Белое худи с принтом змеиной чешуи",
      en: "White hoodie with a snake-scale print",
    },
  },
  hoodieBlackBack: {
    source: "assets/photos/hoodie-black-back.jpg",
    output: "hoodie-black-back.webp",
    alt: {
      ru: "Чёрное худи, вид со спины — большая голова змеи",
      en: "Black hoodie, back view — an oversized snake head",
    },
  },
  packaging: {
    source: "assets/photos/packaging.jpg",
    output: "packaging.webp",
    alt: {
      ru: "Фирменные коробки «Меня запомнят. Краснодар» с номерами 01, 03, 04",
      en: "Signature «They Will Remember Me. Krasnodar» boxes numbered 01, 03, 04",
    },
  },
  hangtag: {
    source: "assets/photos/hangtag.jpg",
    output: "hangtag.webp",
    alt: {
      ru: "Бирка ГАДЮКА с красным раздвоенным языком",
      en: "GADYUKA hang tag with the red forked tongue",
    },
  },
  labelLogo: {
    source: "assets/photos/label-logo.jpg",
    output: "label-logo.webp",
    alt: {
      ru: "Тканевая нашивка с логотипом ГАДЮКА",
      en: "Woven GADYUKA logo label",
    },
  },
  labelTongue: {
    source: "assets/photos/label-tongue.jpg",
    output: "label-tongue.webp",
    alt: {
      ru: "Тканевая нашивка с раздвоенным языком змеи",
      en: "Woven label with the snake's forked tongue",
    },
  },
  lekalaRack: {
    source: "assets/photos/lekala-rack.jpg",
    output: "lekala-rack.webp",
    alt: {
      ru: "Стойка с лекалами в мастерской",
      en: "A rack of sewing patterns in the workshop",
    },
  },
  wordmarkOnBlack: {
    source: "assets/brandbook/01-wordmark-on-black.jpg",
    output: "wordmark-on-black.webp",
    alt: {
      ru: "Вордмарк ГАДЮКА на чёрном фоне",
      en: "GADYUKA wordmark on black",
    },
  },
  wordmarkPatternRed: {
    source: "assets/brandbook/06-wordmark-pattern-red.jpg",
    output: "wordmark-pattern-red.webp",
    alt: {
      ru: "Повторяющийся вордмарк ГАДЮКА на красном",
      en: "Repeating GADYUKA wordmark on red",
    },
  },
  styleElements: {
    source: "assets/brandbook/07-style-elements.jpg",
    output: "style-elements.webp",
    alt: {
      ru: "Фирменные элементы: голова змеи, раздвоенный язык, чешуя",
      en: "Brand elements: the snake's head, forked tongue and scales",
    },
  },
  snakeHeadCloseup: {
    source: "assets/brandbook/14-snake-head-closeup.jpg",
    output: "snake-head-closeup.webp",
    alt: {
      ru: "Голова гадюки в профиль — гравюрная графика бренда",
      en: "The viper's head in profile — the brand's engraving-style artwork",
    },
  },
} as const satisfies Record<string, SeedMedia>;

export type SeedMediaKey = keyof typeof SEED_MEDIA;

export const SEED_MEDIA_DIR = "seed";
