import type { ImageKey } from "../../src/lib/content/registry";
import type { SeedMediaKey } from "./media";

/** Seed copy of every text ContentBlock: lives next to the registry (the site falls back to it). */
export { CONTENT_COPY, type Copy } from "../../src/lib/content/default-copy";

/** Image ContentBlocks → seed media. */
export const CONTENT_IMAGES: Record<ImageKey, SeedMediaKey> = {
  "tailoring.image": "lekalaRack",
  "about.image": "hoodieBlackBack",
};
