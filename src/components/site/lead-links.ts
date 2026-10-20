import type { LeadType } from '@/generated/prisma/enums';
import { isLocale, type Locale } from '@/i18n/locales';
import { LEAD_FORM_ANCHOR } from '@/lib/content/anchors';
import { type LeadIntent, leadIntentHref } from '@/lib/lead-intent';
import { localizedPath } from '@/lib/seo/site-url';

/**
 * Links that open the lead form («Письмо в редакцию») with a preselected topic — isomorphic,
 * pure (unit-tested).
 */

/** Attributes of a CTA link to the form (spread onto <a>). */
export type LeadLinkProps = {
  href: string;
  'data-lead-type': LeadType;
  'data-lead-subject'?: string;
};

/**
 * On the landing (`homePath` = "") → "#lead-form" + data-lead-* (SmoothScroll dispatches the
 * intent on click; without JS it is a plain jump to the form). On other pages → the landing URL
 * with ?topic=…&subject=… (LeadForm applies it after hydration).
 */
export function leadLinkProps(intent: LeadIntent, homePath: string): LeadLinkProps {
  const href = homePath ? leadIntentHref(homePath, intent, LEAD_FORM_ANCHOR) : `#${LEAD_FORM_ANCHOR}`;
  return intent.subject
    ? { href, 'data-lead-type': intent.type, 'data-lead-subject': intent.subject }
    : { href, 'data-lead-type': intent.type };
}

/** Where an offer's button leads. */
export type OfferCta = { kind: 'form'; type: LeadType } | { kind: 'link'; href: string; external: boolean };

/** In-page sections whose CTA is the form, and the topic each one implies. */
const FORM_TOPICS: Readonly<Record<string, LeadType>> = {
  [LEAD_FORM_ANCHOR]: 'CONTACT',
  contacts: 'CONTACT',
  tailoring: 'TAILORING',
  partners: 'PARTNERSHIP',
};

/** "#x", "/#x", "/en#x" — an anchor on the landing (any locale). */
const LANDING_ANCHOR = /^(?:\/(?:[a-z]{2}(?:-[a-z]{2})?)?)?#([\w-]+)$/i;

/**
 * Offer (coupon) button target, from Offer.ctaHref:
 *  - empty, or an anchor of a form-bearing section (#contacts, #tailoring, #partners, #lead-form)
 *    → the form with the matching topic (the coupon title is prefilled as the subject);
 *  - any other anchor / path / URL → a plain link (external http(s) opens in a new tab).
 */
export function offerCta(ctaHref: string | null): OfferCta {
  const href = (ctaHref ?? '').trim();
  if (href === '') return { kind: 'form', type: 'CONTACT' };
  const anchor = LANDING_ANCHOR.exec(href)?.[1];
  const topic = anchor ? FORM_TOPICS[anchor] : undefined;
  if (topic) return { kind: 'form', type: topic };
  return { kind: 'link', href, external: /^https?:\/\//i.test(href) };
}

/**
 * A site-relative link from the CMS (Offer.ctaHref is one string for every language) in the
 * page's language: "/catalog/x" → "/en/catalog/x" on the English site; a language prefix the
 * admin typed is replaced ("/en#gallery" → "/#gallery" on the Russian site). Query and hash are
 * kept; anchors ("#x"), protocol-relative and absolute URLs are returned unchanged.
 */
export function localizeSiteHref(href: string, locale: Locale): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  const cut = href.search(/[?#]/);
  const path = cut === -1 ? href : href.slice(0, cut);
  const rest = cut === -1 ? '' : href.slice(cut);
  const [, first = ''] = path.split('/');
  const bare = isLocale(first) ? path.slice(first.length + 1) || '/' : path;
  return `${localizedPath(locale, bare)}${rest}`;
}
