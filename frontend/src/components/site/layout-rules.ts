/**
 * Pure layout rules of the comic pages (isomorphic, unit-tested): how 0..N entities are laid
 * out on the concept's hand-composed grids without leaving holes, and how wide their
 * pictures are actually drawn (next/image `sizes`).
 */

// ─── Picture sizes ──────────────────────────────────────────────────────────

/**
 * Where an `object-fit: cover` picture sits up to a breakpoint (`maxWidth`, px; none = the
 * widest tier): the slot's width in vw and its aspect ratio (width / height), as laid out by
 * noir.css (measured at 390 / 800 / 1100–1440 px).
 */
export type CoverSlot = { readonly maxWidth?: number; readonly vw: number; readonly aspect: number };

/**
 * next/image `sizes` for a picture drawn with `object-fit: cover`. A picture wider than its
 * slot is scaled to the slot's height and cropped at the sides, so it is rendered wider than
 * the slot: slot width × max(1, picture aspect / slot aspect). Without that factor the
 * browser picks a source that is too small and the photo looks soft (e.g. a 4:3 product shot
 * on a 2:3 comic cover is drawn about twice as wide as the cover).
 */
export function coverSizes(imageAspect: number, slots: ReadonlyArray<CoverSlot>): string {
  const aspect = Number.isFinite(imageAspect) && imageAspect > 0 ? imageAspect : 0;
  return slots
    .map(({ maxWidth, vw, aspect: slotAspect }) => {
      const width = `${Math.ceil(vw * Math.max(1, aspect / slotAspect))}vw`;
      return maxWidth === undefined ? width : `(max-width: ${maxWidth}px) ${width}`;
    })
    .join(', ');
}

/** Width / height of a media reference (0 when unknown). */
export function aspectOf(image: { width: number; height: number } | null | undefined): number {
  return image && image.width > 0 && image.height > 0 ? image.width / image.height : 0;
}

const MOBILE = 699;
const TABLET = 1023;

/** Picture slots of the single-image panels and cards (see noir.css). */
export const PICTURE_SLOTS = {
  /** Product cover art (.cover__art img is 136 % of the art box tall). */
  cover: [
    { maxWidth: MOBILE, vw: 76, aspect: 0.68 },
    { maxWidth: TABLET, vw: 50, aspect: 0.63 },
    { vw: 24, aspect: 0.67 },
  ],
  /** Landscape product photos are framed whole (.cover__art--wide img: 100 % tall). */
  coverWide: [
    { maxWidth: MOBILE, vw: 76, aspect: 0.93 },
    { maxWidth: TABLET, vw: 50, aspect: 0.86 },
    { vw: 24, aspect: 0.91 },
  ],
  /** «О нас» photo panel (.a-photo). */
  aboutPhoto: [
    { maxWidth: MOBILE, vw: 92, aspect: 1.05 },
    { maxWidth: TABLET, vw: 94, aspect: 1.57 },
    { vw: 55, aspect: 1.17 },
  ],
  /** «Индивидуальный пошив» photo panel (.t-photo). */
  tailoringPhoto: [
    { maxWidth: MOBILE, vw: 92, aspect: 1.19 },
    { maxWidth: TABLET, vw: 94, aspect: 1.73 },
    { vw: 55, aspect: 1.36 },
  ],
  /** Collection page cover panel (.collection-cover). */
  collectionCover: [
    { maxWidth: MOBILE, vw: 92, aspect: 1.28 },
    { maxWidth: TABLET, vw: 94, aspect: 2.6 },
    { vw: 39, aspect: 1.2 },
  ],
} as const satisfies Record<string, ReadonlyArray<CoverSlot>>;

/** Newspaper pictures: 16:9 above the lead story, 4:3 under the others; widths follow the columns. */
export function newsPictureSlots(columns: 1 | 2 | 3, lead: boolean): CoverSlot[] {
  const aspect = lead ? 16 / 9 : 4 / 3;
  const desktop = columns === 1 ? 94 : columns === 2 ? (lead ? 57 : 35) : lead ? 43 : 27;
  return [
    { maxWidth: TABLET, vw: 94, aspect },
    { vw: desktop, aspect },
  ];
}

/** Coupon stamp: a fixed square (≤ 92 px) — a pixel `sizes`. */
export function stampSizes(imageAspect: number, sidePx = 92): string {
  const aspect = Number.isFinite(imageAspect) && imageAspect > 0 ? imageAspect : 1;
  return `${Math.ceil(sidePx * Math.max(1, aspect, 1 / aspect))}px`;
}

// ─── Gallery ────────────────────────────────────────────────────────────────

type GallerySlot = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h';
type Wipe = 'left' | 'right' | 'up' | 'down' | 'diag';

export type GalleryCell = {
  slot: GallerySlot;
  /** Spans the whole row (the last item of an incomplete page). */
  full: boolean;
  /** Spans 4 rows instead of 2 (pairs with «a» when only two items are left). */
  tall: boolean;
  wipe: Wipe;
  /** Geometry of the cell per breakpoint — pass it to coverSizes() with the picture's aspect. */
  slots: ReadonlyArray<CoverSlot>;
  /** next/image `sizes` for the cell when the picture's aspect is unknown. */
  sizes: string;
};

/** The concept's 8-panel page: a b c (4 rows), d e f (3 rows), g h (3 rows). */
const PAGE: ReadonlyArray<GallerySlot> = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const WIPES: Readonly<Record<GallerySlot, Wipe>> = {
  a: 'left',
  b: 'down',
  c: 'right',
  d: 'up',
  e: 'diag',
  f: 'up',
  g: 'left',
  h: 'right',
};

/** [mobile (2 columns, 132 px rows), tablet, desktop] width (vw) / aspect of each cell. */
const CELL: Readonly<Record<GallerySlot, readonly [number, number, number, number, number, number]>> = {
  a: [92, 1.3, 54, 1.28, 55, 1.45],
  b: [45, 1.31, 38, 1.9, 39, 2.12],
  c: [45, 1.31, 38, 1.9, 39, 2.12],
  d: [45, 0.63, 22, 0.71, 23, 0.81],
  e: [45, 1.31, 46, 1.48, 47, 1.67],
  f: [45, 1.31, 22, 0.71, 23, 0.81],
  g: [92, 1.3, 46, 1.48, 47, 1.67],
  h: [92, 1.3, 46, 1.48, 47, 1.67],
};
/** A full-width cell (a: 4 rows, d / g: 3 rows) and a tall «b» (4 rows next to «a»). */
const FULL_ASPECT: Readonly<Record<GallerySlot, readonly [number, number]>> = {
  a: [2.4, 2.59],
  b: [2.4, 2.59],
  c: [2.4, 2.59],
  d: [3.2, 3.49],
  e: [3.2, 3.49],
  f: [3.2, 3.49],
  g: [3.2, 3.49],
  h: [3.2, 3.49],
};
const TALL: readonly [number, number, number, number, number, number] = [45, 0.63, 38, 1, 39, 1.06];

function cellSlots(slot: GallerySlot, full: boolean, tall: boolean): CoverSlot[] {
  if (full) {
    const [tablet, desktop] = FULL_ASPECT[slot];
    return [
      { maxWidth: MOBILE, vw: 92, aspect: 1.3 },
      { maxWidth: TABLET, vw: 94, aspect: tablet },
      { vw: 95, aspect: desktop },
    ];
  }
  const [mVw, mAspect, tVw, tAspect, dVw, dAspect] = tall ? TALL : CELL[slot];
  return [
    { maxWidth: MOBILE, vw: mVw, aspect: mAspect },
    { maxWidth: TABLET, vw: tVw, aspect: tAspect },
    { vw: dVw, aspect: dAspect },
  ];
}

/** Slots of an incomplete last page (n = 1…7 items) that still close every row. */
const TAILS: Readonly<Record<number, ReadonlyArray<GallerySlot>>> = {
  1: ['a'],
  2: ['a', 'b'],
  3: ['a', 'b', 'c'],
  4: ['a', 'b', 'c', 'd'],
  5: ['a', 'b', 'c', 'g', 'h'],
  6: ['a', 'b', 'c', 'd', 'e', 'f'],
  7: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
};

export function galleryLayout(count: number): GalleryCell[] {
  const cells: GalleryCell[] = [];
  const fullPages = Math.floor(count / PAGE.length);
  const rest = count % PAGE.length;
  for (let page = 0; page < fullPages; page++) {
    for (const slot of PAGE) cells.push(cell(slot, false, false));
  }
  const tail = TAILS[rest] ?? [];
  tail.forEach((slot, index) => {
    const last = index === tail.length - 1;
    // A lone «a», a lone «d» after a b c, a lone «g» after a…f fill the whole row.
    const full = last && (rest === 1 || rest === 4 || rest === 7);
    const tall = rest === 2 && slot === 'b';
    cells.push(cell(slot, full, tall));
  });
  return cells;
}

function cell(slot: GallerySlot, full: boolean, tall: boolean): GalleryCell {
  const slots = cellSlots(slot, full, tall);
  return { slot, full, tall, wipe: WIPES[slot], slots, sizes: coverSizes(0, slots) };
}

// ─── Reviews ────────────────────────────────────────────────────────────────

export type ReviewPanel = {
  variant: 'a' | 'b' | 'c' | 'd';
  /** Alone in its row → spans the full width. */
  wide: boolean;
  /** Background texture of the panel. */
  texture: 'dots' | 'scales' | 'hatch';
  tone: 'ink' | 'blue';
};

const FIRST_PANEL: Omit<ReviewPanel, 'wide'> = { variant: 'a', texture: 'dots', tone: 'ink' };

const REVIEW_CYCLE: ReadonlyArray<Omit<ReviewPanel, 'wide'>> = [
  FIRST_PANEL,
  { variant: 'b', texture: 'scales', tone: 'blue' },
  { variant: 'c', texture: 'hatch', tone: 'ink' },
  { variant: 'd', texture: 'dots', tone: 'ink' },
];

/** Witness panels go in pairs (7 + 5 / 5 + 7 columns); an odd last one takes the full row. */
export function reviewPanels(count: number): ReviewPanel[] {
  return Array.from({ length: count }, (_, index) => {
    const base = REVIEW_CYCLE[index % REVIEW_CYCLE.length] ?? FIRST_PANEL;
    return { ...base, wide: count % 2 === 1 && index === count - 1 };
  });
}

// ─── Partners ───────────────────────────────────────────────────────────────

/** «Место для партнёра» teaser slots: at least 4 slots in total, and an even number (2 columns). */
export function partnerPlaceholderCount(partners: number): number {
  if (partners < 4) return 4 - partners;
  return partners % 2;
}

// ─── News ───────────────────────────────────────────────────────────────────

/** Newspaper columns: 1 story → one column, 2 → lead + column, 3+ → lead + two columns. */
export function newsColumns(count: number): 1 | 2 | 3 {
  if (count <= 1) return 1;
  return count === 2 ? 2 : 3;
}
