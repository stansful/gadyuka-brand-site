/**
 * Keeping the reader's place when the language is switched (pure, unit-tested): the switcher
 * link "/en" becomes "/en#reviews" when the reader is in the reviews chapter. Section ids are
 * the same in every locale (SECTION_ANCHORS), so the other language opens at the same chapter.
 */

/** In-page anchor ids that may be carried over ("reviews", "lead-form", "product-hoodie-1"). */
const FRAGMENT_ID = /^[A-Za-z][\w-]{0,79}$/;

/** A section's id and the distance of its top edge from the top of the viewport (px). */
export type SectionPosition = { id: string; top: number };

/**
 * The section the reader is in: the last one (in document order) whose top edge has passed
 * `line` (px from the viewport top, e.g. 45 % of its height — the same line as the menu
 * highlight). null before the first section.
 */
export function currentSectionId(sections: ReadonlyArray<SectionPosition>, line: number): string | null {
  let current: string | null = null;
  for (const section of sections) {
    if (section.top <= line) current = section.id;
    else break;
  }
  return current;
}

/** "#reviews" → "reviews"; anything that is not a plain anchor id → null. */
export function fragmentId(hash: string): string | null {
  let id = hash.startsWith("#") ? hash.slice(1) : hash;
  try {
    id = decodeURIComponent(id);
  } catch {
    return null;
  }
  return FRAGMENT_ID.test(id) ? id : null;
}

/**
 * "/en" + "reviews" → "/en#reviews". The cover (`topId`, "home") and invalid ids give the bare
 * path — the other language then simply opens at the top.
 */
export function withSectionHash(href: string, id: string | null, topId?: string): string {
  const base = href.split("#")[0] ?? href;
  if (!id || id === topId || !FRAGMENT_ID.test(id)) return base;
  return `${base}#${id}`;
}
