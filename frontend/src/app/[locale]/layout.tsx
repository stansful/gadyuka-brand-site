import { hasLocale } from 'next-intl';
import { Montserrat, Shantell_Sans, Tektur } from 'next/font/google';
import { notFound } from 'next/navigation';

import { brandAssetStyle } from '@/components/site/brand/brand-assets';
import { BrandDefs } from '@/components/site/brand/BrandDefs';
import { errorCopyFromMessages } from '@/components/site/error-copy';
import { ErrorCopyProvider } from '@/components/site/ErrorCopyProvider';
import { MOTION_BOOT } from '@/components/site/motion/boot';
import { BootScript } from '@/components/site/motion/BootScript';
import { SmoothScroll } from '@/components/site/motion/SmoothScroll';
import { toLocale } from '@/i18n/locales';
import { routing } from '@/i18n/routing';
import { loadSiteMessages } from '@/i18n/site-messages';
import { buildRootMetadata } from '@/lib/seo/metadata';

import type { Metadata, Viewport } from 'next';
import type { ReactElement } from 'react';
import 'lenis/dist/lenis.css';

import '@/styles/noir.css';

/* Typefaces of the «Нуар-комикс» design, self-hosted by next/font (Cyrillic included). */

/**
 * Display: chapter titles, captions, SFX, buttons (a wide technical face close to the Bicubik wordmark).
 * Its fallback until the face arrives (the page paints first — the CSS is inline) is noir.css'
 * "Tektur Caps Fallback": next/font's automatic one fits Arial to average lowercase text and
 * comes out ~14% wider than Tektur in capitals — nearly everything set in Tektur is uppercase —
 * so a title could wrap onto another line and push the page down when the face swaps in.
 */
const displayFont = Tektur({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-tektur',
  display: 'swap',
  adjustFontFallback: false,
  fallback: ['Tektur Caps Fallback'],
});

/** Body text and navigation. */
const bodyFont = Montserrat({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-montserrat',
  display: 'swap',
});

/**
 * Hand lettering: speech bubbles, «Продолжение следует…», the «letter received» stamp — all of
 * it bold upright (noir.css `--f-letter` is only used at 700), so one static weight instead of
 * the variable font. Not preloaded: none of it is on the first screen, the browser fetches the
 * face when such text is laid out (with the chapters' near-viewport gate: when it comes close).
 */
const letterFont = Shantell_Sans({
  subsets: ['latin', 'cyrillic'],
  weight: '700',
  variable: '--font-shantell',
  display: 'swap',
  preload: false,
});

/** Site-wide SEO defaults (metadataBase, title template, OG/Twitter) from SiteSettings. */
export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  return buildRootMetadata(toLocale((await params).locale));
}

export const viewport: Viewport = {
  themeColor: '#010101',
  colorScheme: 'dark',
};

/**
 * The public site renders on request: its data (messages first — loadSiteMessages below) comes
 * from the backend through request-time cached reads (src/lib/api/public.ts: connection() + "use
 * cache" + cacheTag('content')), never at build time — `next build` runs without a backend. So the
 * document blocks on that data; opt this root out of the static-shell / instant-navigation
 * validation (the public pages link with plain <a>, there is no client navigation to keep instant).
 */
export const instant = false;

export function generateStaticParams(): Array<{ locale: string }> {
  return routing.locales.map(locale => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>): Promise<ReactElement> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // The client error boundary (./error.tsx) cannot read messages itself: resolve its copy here.
  // Fail-soft (bundled defaults when the backend is down): nothing catches an error of this layout,
  // and a backend outage is exactly when the error page has to render.
  const errorCopy = errorCopyFromMessages(await loadSiteMessages(locale));

  return (
    // The boot scripts add `motion` / `motion-pending` (/ `is-intro` on the landing) to <html> before hydration.
    // Its style holds the content-hashed URLs of the brand art noir.css draws (brand-assets.ts).
    <html
      lang={locale}
      className={`${displayFont.variable} ${bodyFont.variable} ${letterFont.variable}`}
      style={brandAssetStyle()}
      suppressHydrationWarning
    >
      <body>
        {/* Runs before anything is painted: enables animations unless reduced motion is preferred. */}
        <BootScript code={MOTION_BOOT} />
        <BrandDefs />
        {/* No NextIntlClientProvider: the public client components get their copy as props,
            resolved on the server (src/components/site/labels.ts) — no next-intl client runtime.
            The error boundary gets its few strings from ErrorCopyProvider. */}
        <ErrorCopyProvider copy={errorCopy}>{children}</ErrorCopyProvider>
        <SmoothScroll />
        <div className="grain" aria-hidden="true" />
      </body>
    </html>
  );
}
