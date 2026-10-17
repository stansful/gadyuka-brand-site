import { z } from "zod";

/**
 * zod schemas for non-LocalizedText JSON columns (isomorphic: admin forms reuse them).
 * LocalizedText schemas live in src/lib/i18n-text.ts.
 */

export { SOCIAL_TYPES, type SocialType } from "./social";

/** SiteSettings.socials element. `type` is kept open (string) so old data never breaks reads. */
export const socialLinkSchema = z.object({
  type: z.string().trim().min(1).max(40),
  url: z.url({ protocol: /^https?$/ }).max(500),
});

/** Write-side schema for SiteSettings.socials. */
export const socialLinksSchema = z.array(socialLinkSchema).max(20);

export type SocialLinkInput = z.infer<typeof socialLinkSchema>;

/** Tolerant read: keeps valid entries, drops broken ones. */
export function parseSocialLinks(value: unknown): SocialLinkInput[] {
  if (!Array.isArray(value)) return [];
  const out: SocialLinkInput[] = [];
  for (const item of value) {
    const parsed = socialLinkSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}
